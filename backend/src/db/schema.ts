import {
  customType,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[] | null }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value) {
    if (!value) return null;
    return `[${value.join(",")}]`;
  },
});

export const verticalEnum = pgEnum("vertical", [
  "salon",
  "spa",
  "clinic",
  "home_service",
]);

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
  vertical: verticalEnum("vertical").notNull(),
  timezone: text("timezone").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  businessProfile: jsonb("business_profile")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  phoneNumber: text("phone_number").unique(),
  clerkUserId: text("clerk_user_id").unique(),
  googleCalendarId: text("google_calendar_id"),
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
    callerPhone: text("caller_phone").notNull(),
    livekitRoomName: text("livekit_room_name").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    outcome: callOutcomeEnum("outcome"),
    transcript: text("transcript"),
    summary: text("summary"),
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
    callerPhone: text("caller_phone").notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("knowledge_items_tenant_created_at_idx").on(table.tenantId, table.createdAt)]
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    knowledgeItemId: uuid("knowledge_item_id")
      .notNull()
      .references(() => knowledgeItems.id, { onDelete: "cascade" }),
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("knowledge_chunks_tenant_id_idx").on(table.tenantId)]
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    callerPhone: text("caller_phone").notNull(),
    service: text("service").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    status: appointmentStatusEnum("status").notNull(),
    googleEventId: text("google_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("appointments_tenant_start_time_idx").on(table.tenantId, table.startTime)]
);
