import { inference, voice } from "@livekit/agents";
import type * as silero from "@livekit/agents-plugin-silero";
import { TelephonyBackgroundVoiceCancellation } from "@livekit/noise-cancellation-node";
import { env } from "../env.js";

/**
 * Speech models, pinned here so the versions are visible in one place and
 * assertable in tests.
 *
 * STT: universal-3-5-pro biases transcription on what the agent just said —
 * exactly what fixes misheard names, times and phone numbers on a receptionist
 * call. TTS: sonic-3 is on a deprecation path.
 *
 * Both strings exist only in SDK >= 1.6.4.
 */
export const STT_MODEL = "assemblyai/universal-3-5-pro" as const;
export const TTS_MODEL = "cartesia/sonic-3.5" as const;
const TTS_VOICE = "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc";

export type SessionConfigInput = {
  /** Browser test session from the dashboard, rather than a real SIP call. */
  isTestSession: boolean;
  vad: silero.VAD;
  /**
   * Business and service names, biased into STT. These are the words a
   * streaming recogniser mangles most, and a misheard service name derails a
   * booking. See buildKeyterms().
   */
  keyterms?: string[];
};

export type SessionConfig = {
  sessionOptions: voice.AgentSessionOptions;
  inputOptions: Partial<voice.RoomInputOptions>;
  sttModel: typeof STT_MODEL;
  ttsModel: typeof TTS_MODEL;
};

/**
 * Business name plus service names, de-duplicated and trimmed. Kept separate
 * from buildSessionConfig so the worker can derive it from the tenant without
 * this module needing to know about tenants.
 */
export function buildKeyterms(businessName: string, serviceNames: string[]): string[] {
  return [...new Set([businessName, ...serviceNames].map((t) => t?.trim()).filter(Boolean))];
}

/**
 * Pure — builds the session configuration without touching a room or a job.
 * Extracted from `worker.ts` `entry()` so the pipeline can be asserted without
 * booting a LiveKit worker.
 */
export function buildSessionConfig({
  isTestSession,
  vad,
  keyterms = [],
}: SessionConfigInput): SessionConfig {
  const sessionOptions: voice.AgentSessionOptions = {
    vad,
    stt: new inference.STT({ model: STT_MODEL, language: "en" }),
    // LiveKit Inference rather than OpenRouter. The OpenRouter account has
    // never held credits, so every paid model returns 402 and the agent simply
    // never speaks; the LiveKit plan's included inference allowance works
    // today. It also puts the LLM on the same gateway as STT and TTS, removing
    // a network hop from the live-call path and gaining server-side failover.
    // Overturns the "LLM via OpenRouter" line in PLAN.md, whose stated reason —
    // model flexibility — assumed credits existed.
    llm: new inference.LLM({ model: env.LLM_MODEL as inference.LLMModels }),
    tts: new inference.TTS({ model: TTS_MODEL, voice: TTS_VOICE }),
    // One keyterm set, applied to whichever STT accepts a term list.
    keytermsOptions: { keyterms },
    turnHandling: {
      // Deliberately NOT set. Leaving this undefined makes the SDK provision
      // `inference.TurnDetector` (the audio model — semantics and intonation,
      // no transcript needed) and, because that is a streaming detector, drop
      // the endpointing floor from 500/3000ms to 300/2500ms. Setting anything
      // here — including the old MultilingualModel — forfeits both.
      turnDetection: undefined,
      preemptiveGeneration: { preemptiveTts: true },
    },
  };

  return {
    sessionOptions,
    inputOptions: {
      // Telephony-tuned Krisp model, SIP only. Runs *before* VAD, STT and turn
      // detection, so cleaning the audio improves all three — this is a
      // turn-detection accuracy fix, not an audio-quality nicety.
      //
      // Test sessions come from a laptop microphone at full bandwidth; the
      // telephony model is tuned for 8kHz phone audio and is the wrong tool.
      ...(isTestSession ? {} : { noiseCancellation: TelephonyBackgroundVoiceCancellation() }),
    },
    sttModel: STT_MODEL,
    ttsModel: TTS_MODEL,
  };
}
