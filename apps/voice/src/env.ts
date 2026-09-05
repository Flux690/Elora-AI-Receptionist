import { z } from "zod";
import { parseEnv } from "@receptionist/core/env.js";

const envSchema = z
  .object({
    /** "livekit" shares the gateway with STT and TTS. "openrouter" needs credits. */
    LLM_PROVIDER: z.enum(["livekit", "openrouter"]).default("livekit"),
    /** Model id in the selected provider's format. */
    LLM_MODEL: z.string().min(1),
    SUMMARY_LLM_MODEL: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_BASE_URL: z.string().url().optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.LLM_PROVIDER !== "openrouter") return;
    for (const key of ["OPENROUTER_API_KEY", "OPENROUTER_BASE_URL"] as const) {
      if (!cfg[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Required when LLM_PROVIDER is openrouter",
        });
      }
    }
  });

export const env = parseEnv(envSchema, process.env);
