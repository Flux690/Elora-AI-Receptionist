ALTER TABLE "appointments" RENAME COLUMN "google_event_id" TO "external_event_id";--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "calendar_provider" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "calendar_external_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "calendar_payload" jsonb;--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "google_calendar_id";