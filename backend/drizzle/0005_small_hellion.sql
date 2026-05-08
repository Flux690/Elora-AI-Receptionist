ALTER TABLE "tenants" RENAME COLUMN "vertical" TO "industry";--> statement-breakpoint
ALTER TABLE "tenants" RENAME COLUMN "additional_instructions" TO "description";--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "industry" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "transcript" SET DATA TYPE jsonb USING '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "recording_url" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "services" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "agent_profile" jsonb DEFAULT '{"name":"","greeting":"","farewell":"","fallback":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "business_profile";--> statement-breakpoint
DROP TYPE "public"."vertical";