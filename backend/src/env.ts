import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  /**
   * Comma-separated origins allowed to call the API. Optional so existing .env
   * files keep working; defaults to the Vite dev server. Set this in production
   * to the deployed dashboard origin — the previous unrestricted cors() answered
   * every origin with a wildcard (PLAN.md 1.8.5).
   */
  DASHBOARD_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((o) => o.trim()).filter(Boolean)),
  DATABASE_URL: z.string().min(1),
  LIVEKIT_URL: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url(),
  LLM_MODEL: z.string().min(1),
  SUMMARY_LLM_MODEL: z.string().min(1),
  EMBEDDING_MODEL: z.string().min(1),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  // Throw rather than process.exit(1). A module-level exit kills any process
  // that imports this transitively — including the test runner, with no usable
  // error. The process boundaries (index.ts, agent/worker.ts) catch and exit.
  const detail = _env.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${detail}`);
}

export const env = _env.data;
