ALTER TABLE "knowledge_items" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE UNIQUE INDEX "escalations_call_question_dedup_idx" ON "escalations" USING btree ("call_id",lower("question")) WHERE "escalations"."call_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "knowledge_items_embedding_hnsw_idx" ON "knowledge_items" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN "was_booked";--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN "was_escalated";