ALTER TABLE "phone_numbers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "phone_numbers" CASCADE;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "google_refresh_token";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "google_connected_email";--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_phone_number_unique" UNIQUE("phone_number");