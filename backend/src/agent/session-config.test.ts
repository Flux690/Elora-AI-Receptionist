import { describe, it, expect } from "vitest";
import { buildSessionConfig } from "./session-config.js";

/**
 * PLAN.md 1.4 — the voice pipeline.
 *
 * Three defects this pins down:
 *
 *  1. The turn detector was `livekit.turnDetector.MultilingualModel()`, the older
 *     *text*-based detector. It cannot decide the caller has stopped until STT
 *     produces a final transcript, and sits on a 500ms floor. Leaving
 *     `turnDetection` undefined makes SDK 1.6.4 auto-provision the audio
 *     `inference.TurnDetector` AND swap the endpointing defaults from 500/3000 to
 *     300/2500 (`streamingEndpointingOptions`). The fix is a deletion.
 *
 *  2. `@livekit/noise-cancellation-node` was a declared dependency imported
 *     nowhere, and `session.start()` passed no input options at all. Phone audio
 *     is 8kHz and lossy, and noise cancellation runs *before* VAD, STT and turn
 *     detection — so it is a turn-detection accuracy fix, not an audio nicety.
 *
 *  3. Browser test sessions must NOT get the telephony model. It is tuned for
 *     8kHz phone audio; test sessions come from a laptop microphone.
 */
describe("buildSessionConfig", () => {
  const vad = { label: "fake-vad" } as never;

  describe("turn detection", () => {
    it("leaves turnDetection unset so the SDK provisions the audio detector", () => {
      const { sessionOptions } = buildSessionConfig({ isTestSession: false, vad });

      // Explicitly present-but-undefined is fine; a MultilingualModel is not.
      expect(sessionOptions.turnHandling?.turnDetection).toBeUndefined();
    });

    it("keeps preemptive TTS on", () => {
      const { sessionOptions } = buildSessionConfig({ isTestSession: false, vad });
      expect(sessionOptions.turnHandling?.preemptiveGeneration).toEqual({
        preemptiveTts: true,
      });
    });
  });

  describe("noise cancellation", () => {
    it("applies telephony cancellation to SIP calls", () => {
      const { inputOptions } = buildSessionConfig({ isTestSession: false, vad });
      expect(inputOptions.noiseCancellation).toBeDefined();
    });

    it("does NOT apply it to browser test sessions", () => {
      const { inputOptions } = buildSessionConfig({ isTestSession: true, vad });
      expect(inputOptions.noiseCancellation).toBeUndefined();
    });
  });

  describe("keyterms", () => {
    /**
     * Service names, staff names and the business name are exactly the
     * vocabulary streaming STT mangles, and a misheard service name derails a
     * booking. LiveKit manages one keyterm set across providers (PLAN.md 1.5).
     */
    it("biases STT toward the business and service names", () => {
      const { sessionOptions } = buildSessionConfig({
        isTestSession: false,
        vad,
        keyterms: ["Test Salon", "Haircut", "Colour"],
      });

      expect(sessionOptions.keytermsOptions?.keyterms).toEqual(
        expect.arrayContaining(["Test Salon", "Haircut", "Colour"])
      );
    });

    it("omits keyterms entirely when there are none", () => {
      const { sessionOptions } = buildSessionConfig({ isTestSession: false, vad });
      expect(sessionOptions.keytermsOptions?.keyterms ?? []).toEqual([]);
    });
  });

  describe("speech models", () => {
    it("uses the current STT and TTS model versions", () => {
      const { sttModel, ttsModel } = buildSessionConfig({ isTestSession: false, vad });
      // universal-3-5-pro biases transcription on what the agent just said,
      // which is what fixes misheard names, times and phone numbers.
      expect(sttModel).toBe("assemblyai/universal-3-5-pro");
      // sonic-3 is on a deprecation path.
      expect(ttsModel).toBe("cartesia/sonic-3.5");
    });
  });
});
