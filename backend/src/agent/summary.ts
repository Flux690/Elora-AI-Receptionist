import type { TranscriptEntry } from "../db/schema.js";
import { env } from "../env.js";
import { openrouter } from "../llm.js";

const SUMMARY_PROMPT = `Summarize this phone call in 3-4 sentences. Focus on:
- What the caller wanted
- What was resolved or answered
- Any follow-ups needed (escalations, callbacks, pending bookings)
Keep it factual and concise. Do not use bullet points.`;

const MIN_SUMMARY_ENTRIES = 3;

export async function generateCallSummary(transcript: TranscriptEntry[]): Promise<string> {
  if (transcript.length < MIN_SUMMARY_ENTRIES) return "";

  const formatted = transcript
    .map((entry) => `${entry.role === "user" ? "Caller" : "Agent"}: ${entry.text}`)
    .join("\n");

  try {
    const response = await openrouter.chat.completions.create({
      model: env.SUMMARY_LLM_MODEL,
      messages: [
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: formatted },
      ],
      max_tokens: 300,
    });
    return response.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[summary] LLM call failed:", err);
    return "";
  }
}
