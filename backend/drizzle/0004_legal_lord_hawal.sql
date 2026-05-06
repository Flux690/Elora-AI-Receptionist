ALTER TABLE "tenants" RENAME COLUMN "system_prompt" TO "additional_instructions";--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "sip_dispatch_rule_id" text;