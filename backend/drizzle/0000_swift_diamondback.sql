-- pgvector must exist before any vector column is declared. Without this the
-- chain dies on knowledge_items with: type "vector" does not exist.
-- Previously enabled by hand in the Neon console, which made the repo unable
-- to stand up a working database from scratch (PLAN.md 1.6.1).
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('requested', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."call_outcome" AS ENUM('answered', 'booked', 'escalated', 'abandoned', 'error');--> statement-breakpoint
CREATE TYPE "public"."escalation_status" AS ENUM('pending', 'resolved');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid,
	"caller_phone" text NOT NULL,
	"service" text NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"status" "appointment_status" NOT NULL,
	"google_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid,
	"caller_phone" text NOT NULL,
	"livekit_room_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"outcome" "call_outcome",
	"transcript" jsonb,
	"summary" text,
	"recording_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone_number" text NOT NULL,
	"name" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_tenant_phone_unique" UNIQUE("tenant_id","phone_number")
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"call_id" uuid,
	"client_id" uuid,
	"caller_phone" text NOT NULL,
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
	"tenant_id" uuid NOT NULL,
	"source_escalation_id" uuid,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"industry" text DEFAULT '' NOT NULL,
	"timezone" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agent_profile" jsonb DEFAULT '{"name":"","greeting":"","farewell":"","fallback":"","holdPhrase":""}'::jsonb NOT NULL,
	"phone_number" text,
	"clerk_user_id" text,
	"google_calendar_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_phone_number_unique" UNIQUE("phone_number"),
	CONSTRAINT "tenants_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_source_escalation_id_escalations_id_fk" FOREIGN KEY ("source_escalation_id") REFERENCES "public"."escalations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_tenant_start_time_idx" ON "appointments" USING btree ("tenant_id","start_time");--> statement-breakpoint
CREATE INDEX "calls_tenant_started_at_idx" ON "calls" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "clients_tenant_last_seen_idx" ON "clients" USING btree ("tenant_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "escalations_tenant_status_created_at_idx" ON "escalations" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "escalations_call_question_dedup_idx" ON "escalations" USING btree ("call_id",lower("question")) WHERE "escalations"."call_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "knowledge_items_tenant_created_at_idx" ON "knowledge_items" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_items_embedding_hnsw_idx" ON "knowledge_items" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);