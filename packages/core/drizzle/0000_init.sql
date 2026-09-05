CREATE TYPE "public"."appointment_status" AS ENUM('requested', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."call_outcome" AS ENUM('answered', 'booked', 'escalated', 'abandoned', 'error');--> statement-breakpoint
CREATE TYPE "public"."escalation_status" AS ENUM('pending', 'resolved');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"persona_name" text DEFAULT '' NOT NULL,
	"industry" text DEFAULT '' NOT NULL,
	"timezone" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"greeting" text DEFAULT '' NOT NULL,
	"farewell" text DEFAULT '' NOT NULL,
	"fallback" text DEFAULT '' NOT NULL,
	"business_hours" jsonb DEFAULT '{"weekly":{"mon":[{"start":"09:00","end":"17:00"}],"tue":[{"start":"09:00","end":"17:00"}],"wed":[{"start":"09:00","end":"17:00"}],"thu":[{"start":"09:00","end":"17:00"}],"fri":[{"start":"09:00","end":"17:00"}],"sat":[],"sun":[]},"exceptions":[]}'::jsonb NOT NULL,
	"min_notice_minutes" integer DEFAULT 30 NOT NULL,
	"max_advance_days" integer DEFAULT 60 NOT NULL,
	"record_calls" boolean DEFAULT true NOT NULL,
	"checklist_dismissed" boolean DEFAULT false NOT NULL,
	"hours_seen" boolean DEFAULT false NOT NULL,
	"clerk_user_id" text,
	"calendar_provider" text,
	"calendar_external_id" text,
	"calendar_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"caller_id" uuid,
	"caller_phone" text,
	"caller_name" text,
	"service_id" uuid,
	"service_name" text NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"status" "appointment_status" NOT NULL,
	"external_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "callers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"phone_number" text NOT NULL,
	"name" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "callers_agent_phone_unique" UNIQUE("agent_id","phone_number")
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"caller_id" uuid,
	"caller_phone" text,
	"room_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"outcome" "call_outcome",
	"transcript" jsonb,
	"summary" text,
	"recording_key" text,
	"disclosure_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"call_id" uuid,
	"caller_id" uuid,
	"caller_phone" text,
	"caller_name" text,
	"question" text NOT NULL,
	"transcript_excerpt" text,
	"status" "escalation_status" DEFAULT 'pending' NOT NULL,
	"answer" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"source_escalation_id" uuid,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"e164" text NOT NULL,
	"provider" text DEFAULT 'livekit' NOT NULL,
	"provider_sid" text,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_numbers_e164_unique" UNIQUE("e164")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"required_resources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_caller_id_callers_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."callers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callers" ADD CONSTRAINT "callers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_id_callers_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."callers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_caller_id_callers_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."callers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_source_escalation_id_escalations_id_fk" FOREIGN KEY ("source_escalation_id") REFERENCES "public"."escalations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_agent_start_time_idx" ON "appointments" USING btree ("agent_id","start_time");--> statement-breakpoint
CREATE INDEX "callers_agent_last_seen_idx" ON "callers" USING btree ("agent_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "calls_agent_started_at_idx" ON "calls" USING btree ("agent_id","started_at");--> statement-breakpoint
CREATE INDEX "escalations_agent_status_created_at_idx" ON "escalations" USING btree ("agent_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "escalations_call_question_dedup_idx" ON "escalations" USING btree ("call_id",lower("question")) WHERE "escalations"."call_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "knowledge_items_agent_created_at_idx" ON "knowledge_items" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "phone_numbers_agent_idx" ON "phone_numbers" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "services_agent_position_idx" ON "services" USING btree ("agent_id","position");