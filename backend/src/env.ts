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
  /**
   * Which gateway serves the in-call and summariser models.
   *
   * "livekit"    — LiveKit Inference. Same gateway as STT and TTS, so one less
   *                network hop and server-side failover. Metered against the
   *                plan's included allowance, which is a hard cap on Build.
   * "openrouter" — OpenRouter. Wider model choice across providers, but needs
   *                credits on the account: without them every request is a 402
   *                and the agent silently never speaks.
   *
   * LLM_MODEL and SUMMARY_LLM_MODEL must use the matching id format for
   * whichever is selected.
   */
  LLM_PROVIDER: z.enum(["livekit", "openrouter"]).default("livekit"),
  /**
   * Model id for the in-call brain, in the selected provider's format —
   * e.g. "google/gemini-3.5-flash" on livekit,
   * "anthropic/claude-haiku-4.5" on openrouter.
   */
  LLM_MODEL: z.string().min(1),
  /** LiveKit Inference model id for post-call summaries. */
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
