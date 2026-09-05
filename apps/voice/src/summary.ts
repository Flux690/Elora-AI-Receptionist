import { llm } from "@livekit/agents";
import type { TranscriptEntry } from "@receptionist/core/db/schema.js";
import { env } from "./env.js";
import { buildLLM } from "./session-config.js";

const SUMMARY_PROMPT = `Summarize this phone call in 3-4 sentences. Focus on:
- What the caller wanted
- What was resolved or answered
- Any follow-ups needed (escalations, callbacks, pending bookings)
Keep it factual and concise. Do not use bullet points.`;

const MIN_SUMMARY_ENTRIES = 3;

/**
 * Post-call summary, through whichever gateway LLM_PROVIDER selects.
 *
 * Through the same gateway as the in-call model, so the two cannot drift.
 * LiveKit Inference reads LIVEKIT_API_KEY/SECRET from the environment and needs
 * no job context, so it works here in the session close handler; OpenRouter
 * without credits returns "" on every call and says nothing about why.
 *
 * Deliberately a small model with reasoning off — PLAN.md 1.3 notes that larger
 * models are measurably *worse* at this job, embellishing and inventing
 * follow-ups that were never discussed.
 */
export async function generateCallSummary(transcript: TranscriptEntry[]): Promise<string> {
  if (transcript.length < MIN_SUMMARY_ENTRIES) return "";

  const formatted = transcript
    .map((entry) => `${entry.role === "user" ? "Caller" : "Agent"}: ${entry.text}`)
    .join("\n");

  const model = buildLLM(env.SUMMARY_LLM_MODEL);

  const chatCtx = llm.ChatContext.empty();
  chatCtx.addMessage({ role: "system", content: SUMMARY_PROMPT });
  chatCtx.addMessage({ role: "user", content: formatted });

  try {
    const stream = model.chat({ chatCtx });
    let text = "";
    for await (const chunk of stream) {
      const delta = chunk.delta?.content;
      if (delta) text += delta;
    }
    const summary = text.trim();
    if (!summary) {
      // The model streamed nothing at all. Providers do not always throw on
      // failure — an OpenRouter 402 yields an empty stream and no exception —
      // so silence here is a signal, not a normal outcome.
      console.warn(
        `[summary] model ${env.SUMMARY_LLM_MODEL} via ${env.LLM_PROVIDER} returned nothing; ` +
          `check provider credits or quota`
      );
    }
    return summary;
  } catch (err) {
    // A missing summary is not worth failing call finalization over — the
    // transcript, outcome and recording are all still written.
    console.error("[summary] generation failed:", err instanceof Error ? err.message : err);
    return "";
  } finally {
    await model.aclose().catch(() => {});
  }
}
