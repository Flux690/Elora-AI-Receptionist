import { inference, llm } from "@livekit/agents";
import type { TranscriptEntry } from "../db/schema.js";
import { env } from "../env.js";

const SUMMARY_PROMPT = `Summarize this phone call in 3-4 sentences. Focus on:
- What the caller wanted
- What was resolved or answered
- Any follow-ups needed (escalations, callbacks, pending bookings)
Keep it factual and concise. Do not use bullet points.`;

const MIN_SUMMARY_ENTRIES = 3;

/**
 * Post-call summary, via LiveKit Inference.
 *
 * Moved off OpenRouter along with the in-call model: that account has never
 * held credits, so this silently returned "" on every call. LiveKit Inference
 * reads LIVEKIT_API_KEY/SECRET from the environment and needs no job context,
 * so it works here in the session close handler.
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

  const model = new inference.LLM({
    model: env.SUMMARY_LLM_MODEL as inference.LLMModels,
  });

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
    return text.trim();
  } catch (err) {
    // A missing summary is not worth failing call finalization over — the
    // transcript, outcome and recording are all still written.
    console.error("[summary] generation failed:", err instanceof Error ? err.message : err);
    return "";
  } finally {
    await model.aclose().catch(() => {});
  }
}
