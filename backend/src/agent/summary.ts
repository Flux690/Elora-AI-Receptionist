import type { TranscriptEntry } from "../db/schema.js";

const SUMMARY_PROMPT = `Summarize this phone call in 3-4 sentences. Focus on:
- What the caller wanted
- What was resolved or answered
- Any follow-ups needed (escalations, callbacks, pending bookings)
Keep it factual and concise. Do not use bullet points.`;

export async function generateCallSummary(
  transcript: TranscriptEntry[],
  config: { model: string; baseURL: string; apiKey: string }
): Promise<string> {
  const formatted = transcript
    .map((entry) => `${entry.role === "user" ? "Caller" : "Agent"}: ${entry.text}`)
    .join("\n");

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: formatted },
      ],
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    console.error("[summary] LLM call failed:", response.status, await response.text());
    return "";
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  return data.choices[0]?.message?.content?.trim() ?? "";
}
