import { llm } from "@livekit/agents";
import type { TranscriptEntry } from "@receptionist/shared";

export function extractTranscript(history: llm.ChatContext): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];

  for (const item of history.items) {
    if (!(item instanceof llm.ChatMessage)) continue;
    if (item.role !== "user" && item.role !== "assistant") continue;

    const text = item.textContent;
    if (!text) continue;

    entries.push({
      role: item.role,
      text,
    });
  }

  return entries;
}
