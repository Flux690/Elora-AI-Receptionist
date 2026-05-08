ALTER TABLE "tenants" ALTER COLUMN "agent_profile" SET DEFAULT '{"name":"","greeting":"","farewell":"","fallback":"","holdPhrase":""}'::jsonb;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "was_booked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "was_escalated" boolean DEFAULT false NOT NULL;