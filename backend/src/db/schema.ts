import {
  boolean,
  customType,
  index,
  integer,
  uniqueIndex,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_BOOKING_POLICY,
  type AgentProfile,
  type TranscriptEntry,
  type CalendarProvider,
  type CalendarPayload,
  type BusinessHours,
  type BookingPolicy,
  type TenantSetup,
} from "@receptionist/shared";
export type {
  Service,
  ServiceDraft,
  AgentProfile,
  TranscriptEntry,
  CalendarProvider,
  CalendarPayload,
  BusinessHours,
  BookingPolicy,
  TenantSetup,
} from "@receptionist/shared";
export type { CallOutcome } from "@receptionist/shared";

/**
 * Fixed at 1536 (the output width of text-embedding-3-small). Deliberately NOT
 * read from env.EMBEDDING_DIMENSIONS: deriving DDL from the environment makes
 * the same schema file emit different columns in different environments, and a
 * generated migration then drops and recreates this column, destroying every
 * stored embedding without saying so.
 *
 * EMBEDDING_DIMENSIONS is the runtime assertion in services/knowledge.ts, which
 * checks what the model actually returned. Changing this width is an explicit,
 * written migration that re-embeds — never a config side effect.
 */
const EMBEDDING_DIMENSIONS = 1536;

const vector = customType<{ data: number[] | null }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSIONS})`;
  },
  toDriver(value) {
    if (!value) return null;
    return `[${value.join(",")}]`;
  },
});



export const callOutcomeEnum = pgEnum("call_outcome", [
  "answered",
  "booked",
  "escalated",
  "abandoned",
  "error",
]);

export const escalationStatusEnum = pgEnum("escalation_status", [
  "pending",
  "resolved",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "requested",
  "confirmed",
  "cancelled",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull().default(""),
  timezone: text("timezone").notNull(),
  description: text("description").notNull().default(""),
  /**
   * Opening hours, as a whole. jsonb rather than a table for the same reason
   * `agent_profile` is: it is always read entire, alongside the tenant row, and
   * nothing ever queries one weekday on its own. Local wall-clock times plus
   * `timezone` above — never UTC, so "we open at 9" survives daylight saving.
   */
  businessHours: jsonb("business_hours")
    .$type<BusinessHours>()
    .notNull()
    .default(DEFAULT_BUSINESS_HOURS),
  bookingPolicy: jsonb("booking_policy")
    .$type<BookingPolicy>()
    .notNull()
    .default(DEFAULT_BOOKING_POLICY),
  agentProfile: jsonb("agent_profile").$type<AgentProfile>().notNull().default({
    name: "",
    greeting: "",
    farewell: "",
    fallback: "",
  }),
  /**
   * Whether calls are recorded to R2.
   *
   * Defaults true, which is what every existing tenant was already getting — a
   * default of false would silently stop recording for everyone on deploy.
   *
   * Not purely a storage switch: it selects which AI disclosure plays, because a
   * greeting that claims the call is recorded when it is not is its own kind of
   * wrong. See `agent/disclosure.ts`.
   */
  recordCalls: boolean("record_calls").notNull().default(true),
  /**
   * What the owner has been through, for the checklist on Home.
   *
   * Two flags rather than a derived value. `checklistDismissed` has to be
   * remembered or hiding it is pointless; `hoursSeen` exists because opening
   * hours are valid from the moment a tenant is created — DEFAULT_BUSINESS_HOURS
   * is Mon-Fri 9-5 — so that item can never tick itself off by looking at the
   * data. Services and the calendar can, and so are not stored here.
   */
  setup: jsonb("setup").$type<TenantSetup>().notNull().default({
    checklistDismissed: false,
    hoursSeen: false,
  }),
  phoneNumber: text("phone_number").unique(),
  clerkUserId: text("clerk_user_id").unique(),
  /**
   * Scheduling adapter (PLAN.md 2.5).
   *
   * Three generic columns — who provides the calendar, its id in their system,
   * and whatever is needed to show it back to the user — rather than one named
   * after a vendor, which is the single place a schema forecloses ever
   * supporting anything else.
   *
   * `calendarPayload` holds display data only — the calendar's name and its own
   * timezone — so Settings can render "Bookings" instead of a raw id without a
   * round trip to Google. Never read on the call path.
   */
  calendarProvider: text("calendar_provider").$type<CalendarProvider>(),
  calendarExternalId: text("calendar_external_id"),
  calendarPayload: jsonb("calendar_payload").$type<CalendarPayload>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    name: text("name"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("clients_tenant_phone_unique").on(table.tenantId, table.phoneNumber),
    index("clients_tenant_last_seen_idx").on(table.tenantId, table.lastSeenAt),
  ]
);

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    callerPhone: text("caller_phone"),
    livekitRoomName: text("livekit_room_name").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    outcome: callOutcomeEnum("outcome"),
    transcript: jsonb("transcript").$type<TranscriptEntry[]>(),
    summary: text("summary"),
    recordingUrl: text("recording_url"),
    /**
     * Which AI-disclosure wording this caller heard.
     *
     * The audit trail for PLAN.md 2.6: proving what was said, on which call, is
     * the entire point of a per-call $500 penalty regime. Nullable because rows
     * written before the disclosure existed genuinely had none.
     */
    disclosureVersion: text("disclosure_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("calls_tenant_started_at_idx").on(table.tenantId, table.startedAt)]
);

export const escalations = pgTable(
  "escalations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    callId: uuid("call_id").references(() => calls.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    callerPhone: text("caller_phone"),
    /**
     * The name the caller gave when the question was escalated.
     *
     * An escalation is a promise to ring somebody back, so the dashboard needs
     * to say who. Same reasoning as `appointments.caller_name`: an anonymous
     * caller has no client row, so there is nowhere else to put it. Nullable
     * because a caller may decline and the agent does not press.
     */
    callerName: text("caller_name"),
    question: text("question").notNull(),
    transcriptExcerpt: text("transcript_excerpt"),
    status: escalationStatusEnum("status").notNull().default("pending"),
    answer: text("answer"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("escalations_tenant_status_created_at_idx").on(
      table.tenantId,
      table.status,
      table.createdAt
    ),
    uniqueIndex("escalations_call_question_dedup_idx")
      .on(table.callId, sql`lower(${table.question})`)
      .where(sql`${table.callId} IS NOT NULL`),
  ]
);

export const knowledgeItems = pgTable(
  "knowledge_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceEscalationId: uuid("source_escalation_id").references(() => escalations.id, {
      onDelete: "set null",
    }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_items_tenant_created_at_idx").on(table.tenantId, table.createdAt),
    index("knowledge_items_embedding_hnsw_idx")
      .using("hnsw", table.embedding.op("vector_cosine_ops"))
      .with({ m: 16, ef_construction: 64 }),
  ]
);


/**
 * Bookable services, one row each.
 *
 * Promoted out of `tenants.services` jsonb. The reason is not tenancy — every
 * table here is tenant-scoped — it is that a booking needs something permanent
 * to point at. In a blob a service is just a position in a list, so a booking
 * could only record the *word* "Haircut"; renaming it orphaned every past
 * appointment with nothing to warn you.
 */
export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: text("price").notNull().default(""),
    description: text("description").notNull().default(""),
    /** How long the caller is actually with you. Was hardcoded to 60. */
    durationMinutes: integer("duration_minutes").notNull().default(60),
    /**
     * Time the calendar must hold either side but the caller never hears about
     * — setup, cleanup, travel. Widens the block, not the appointment.
     */
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    /** Plural from day one, always empty today. See PLAN.md 2.5. */
    requiredResources: jsonb("required_resources")
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Display order, so the dashboard list is stable and reorderable. */
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("services_tenant_position_idx").on(table.tenantId, table.position)]
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    callerPhone: text("caller_phone"),
    /**
     * The name the caller gave at booking.
     *
     * Separate from `clients.name` on purpose: a caller with no number has no
     * client row, so there is nowhere else to put it — and the business still
     * needs to know who to expect. Nullable because a caller may decline.
     */
    callerName: text("caller_name"),
    /**
     * The service booked. `serviceId` is the live link; `service` is the name as
     * it stood at booking time, kept so history stays readable after a rename
     * and survives the service being deleted altogether.
     */
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    service: text("service").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    status: appointmentStatusEnum("status").notNull(),
    /**
     * The event's id in whichever calendar provider the tenant connected. The
     * provider itself lives on `tenants.calendar_provider` rather than being
     * repeated on every row — an appointment cannot belong to a different
     * provider than the tenant it was booked through.
     */
    externalEventId: text("external_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("appointments_tenant_start_time_idx").on(table.tenantId, table.startTime)]
);
