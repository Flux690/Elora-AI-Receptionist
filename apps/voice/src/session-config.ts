import { inference, llm, voice } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import type * as silero from "@livekit/agents-plugin-silero";
import { TelephonyBackgroundVoiceCancellation } from "@livekit/noise-cancellation-node";
import { env } from "./env.js";

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
 * Builds the LLM client for whichever gateway LLM_PROVIDER selects.
 *
 * Defaults to LiveKit Inference: it shares the gateway with STT and TTS, so the
 * LLM loses a network hop on the live-call path and gains server-side failover.
 *
 * OpenRouter is a one-line switch rather than a code change, because it offers
 * models LiveKit Inference does not. It needs credits on the account: without
 * them every request is a 402 and the agent never speaks, with nothing in the
 * log to say so.
 */
export function buildLLM(model: string): llm.LLM {
  if (env.LLM_PROVIDER === "openrouter") {
    return new openai.LLM({
      model,
      baseURL: env.OPENROUTER_BASE_URL,
      apiKey: env.OPENROUTER_API_KEY,
    });
  }
  return new inference.LLM({ model: model as inference.LLMModels });
}

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
    llm: buildLLM(env.LLM_MODEL),
    tts: new inference.TTS({ model: TTS_MODEL, voice: TTS_VOICE }),
    // One keyterm set, applied to whichever STT accepts a term list.
    keytermsOptions: { keyterms },
    turnHandling: {
      // Deliberately NOT set. Leaving this undefined makes the SDK provision
      // `inference.TurnDetector` (the audio model — semantics and intonation,
      // no transcript needed) and, because that is a streaming detector, drop
      // the endpointing floor from 500/3000ms to 300/2500ms. Setting anything
      // here — `MultilingualModel` included — forfeits both.
      turnDetection: undefined,
      // Preemptive generation stays ON: the LLM starts before end-of-turn is
      // confirmed, which is where most of the latency win is, and a discarded
      // guess costs only tokens.
      //
      // preemptiveTts stays OFF, which is LiveKit's default and what their own
      // examples use. With it on, TTS synthesises a guess before the turn is
      // confirmed — and the docs are explicit that "if the chat context or tools
      // change... the speculative response is discarded and regenerated". A
      // discarded guess that has already been turned into audio is audio that
      // was already on its way to the caller. That is the shape of the two
      // failures seen in production: a turn spoken that should not have been,
      // and a real answer that never played.
      preemptiveGeneration: { preemptiveTts: false },
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
