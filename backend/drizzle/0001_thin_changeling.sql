ALTER TABLE "appointments" ALTER COLUMN "caller_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "caller_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "escalations" ALTER COLUMN "caller_phone" DROP NOT NULL;