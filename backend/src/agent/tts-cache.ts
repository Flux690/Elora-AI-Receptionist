import type { AudioFrame } from "@livekit/rtc-node";
import { ReadableStream } from "node:stream/web";
import { tts as ttsNs, voice } from "@livekit/agents";

// Process-local cache: keyed by "${tenantId}:greeting" | "${tenantId}:hold" | "${tenantId}:farewell"
const cache = new Map<string, AudioFrame>();

export async function getOrSynthesize(
  tts: ttsNs.TTS,
  key: string,
  text: string
): Promise<AudioFrame> {
  const cached = cache.get(key);
  if (cached) return cached;

  const frame = await tts.synthesize(text).collect();
  cache.set(key, frame);
  return frame;
}

function frameToStream(frame: AudioFrame): ReadableStream<AudioFrame> {
  return new ReadableStream<AudioFrame>({
    start(controller) {
      controller.enqueue(frame);
      controller.close();
    },
  });
}

export async function sayCached(
  session: voice.AgentSession,
  tts: ttsNs.TTS,
  key: string,
  text: string
) {
  const frame = await getOrSynthesize(tts, key, text);
  const audioStream = frameToStream(frame);
  return session.say(text, { audio: audioStream });
}

export function invalidate(key: string): void {
  cache.delete(key);
}

export function invalidateTenant(tenantId: string): void {
  cache.delete(`${tenantId}:greeting`);
  cache.delete(`${tenantId}:hold`);
  cache.delete(`${tenantId}:farewell`);
}
