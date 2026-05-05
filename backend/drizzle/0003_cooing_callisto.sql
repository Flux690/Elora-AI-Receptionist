DROP TABLE "knowledge_chunks" CASCADE;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD COLUMN "embedding" vector(2048);