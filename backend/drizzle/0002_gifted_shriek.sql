ALTER TABLE "tenants" ADD COLUMN "clerk_user_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_clerk_user_id_unique" UNIQUE("clerk_user_id");