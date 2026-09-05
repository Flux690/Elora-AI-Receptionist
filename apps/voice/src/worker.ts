import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  voice,
} from "@livekit/agents";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import type { CallOutcome } from "@receptionist/shared";
import { db } from "@receptionist/core/db/client.js";
import { calls as callsTable } from "@receptionist/core/db/schema.js";
import { upsertCaller } from "@receptionist/core/repositories/callers.js";
import { createCall, finishCall } from "@receptionist/core/repositories/calls.js";
import { recordingEnabled, startCallRecording, stopCallRecording } from "@receptionist/core/providers/storage.js";
import { getGoogleOAuthToken } from "@receptionist/core/providers/googleAuth.js";
import type { AgentDeps, CallState, SlotStore } from "./types.js";
import { buildSessionConfig, buildKeyterms } from "./session-config.js";
import { resolveCallerPhone } from "./caller.js";
import { buildGreeting } from "./disclosure.js";
import { ReceptionistAgent } from "./receptionist.js";
import { CallMetrics } from "./metrics.js";
import { extractTranscript } from "./transcript.js";
import { generateCallSummary } from "./summary.js";
import { resolveAgent, type ResolvedAgent } from "./agent-config.js";

// ── Egress stop with retry ────────────────────────────────────────────────────
// A single failed stopEgress leaves the LiveKit egress running and billing.
// Retry up to maxAttempts with linear backoff before logging a leak warning.
async function stopEgressWithRetry(egressId: string, maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await stopCallRecording(egressId);
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(`[worker] stopEgress failed after ${maxAttempts} attempts — egress ${egressId} may be leaking:`, err);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    // 1. Connect + wait for participant (SIP caller or browser test session)
    await ctx.connect();
    const roomName = ctx.room.name ?? "";
    const participant = await ctx.waitForParticipant();

    const isTestSession = participant.attributes["testSession"] === "true";

    const callerPhone = resolveCallerPhone(participant.attributes, isTestSession);
    const rawTrunk = !isTestSession ? (participant.attributes["sip.trunkPhoneNumber"] ?? "") : "";
    const trunkPhone = rawTrunk && !rawTrunk.startsWith("+") ? `+${rawTrunk}` : rawTrunk;

    // Blocks the critical path on a cache miss: the caller hears silence for one
    // DB round trip. Mitigated by the LRU below, not eliminated.
    let resolved: ResolvedAgent | null = null;

    if (isTestSession) {
      const agentId = participant.attributes["agentId"];
      if (!agentId) {
        console.error("[worker] no agentId in participant attributes for test session — dropping");
        return;
      }
      resolved = await resolveAgent({ agentId });
    } else {
      if (!trunkPhone) {
        console.error(`[worker] No trunkPhoneNumber found for SIP participant — dropping`);
        return;
      }
      resolved = await resolveAgent({ phoneNumber: trunkPhone });
    }

    if (!resolved) {
      console.error(`[worker] agent not found — dropping`);
      return;
    }
    const { agent, services, knowledge } = resolved;
    console.log(`[worker] resolved agent: ${agent.id}${isTestSession ? " (test session)" : ""}`);

    // 3. Fire Google OAuth token fetch in background (no await — resolves while greeting plays).
    //    Token is cached at module level with a 50-minute TTL so repeat calls skip the network.
    const tokenPromise: Promise<string | null> =
      agent.calendarExternalId && agent.clerkUserId
        ? getGoogleOAuthToken(agent.clerkUserId)
        : Promise.resolve(null);

    // 4. Generate callId locally — zero DB roundtrip needed
    const callId = crypto.randomUUID();

    // 5. Build deps immediately with what we have.
    //    client starts null — set after upsertCaller resolves (step 10).
    //    Tools fire only after caller speaks + LLM responds, so client will
    //    always be populated by the time any tool execute() runs.
    const callState: CallState = { wasBooked: false, wasEscalated: false };
    // Slots the agent offers during this call. In memory and per call: an offer
    // is only good while the conversation lasts, and booking re-checks the
    // calendar anyway.
    const slots: SlotStore = { held: new Map(), nextId: 1 };

    // Deferred rather than started here: creating it now keeps the DB write off
    // the path to first audio, while still giving tools something to await.
    // Test sessions never write a call row, so they resolve false immediately.
    let markCallRowReady: (created: boolean) => void = () => {};
    const callRowReady = isTestSession
      ? Promise.resolve(false)
      : new Promise<boolean>((resolve) => {
          markCallRowReady = resolve;
        });

    const deps: AgentDeps = {
      agent,
      services,
      caller: null,
      callerPhone,
      callId,
      getGoogleToken: () => tokenPromise,
      calendarExternalId: agent.calendarExternalId ?? null,
      knowledge,
      callRowReady,
      callState,
      slots,
    };

    // 6. Build the pipeline. See session-config.ts for why turnDetection is
    //    left unset and why noise cancellation is SIP-only.
    const { sessionOptions, inputOptions } = buildSessionConfig({
      isTestSession,
      vad: ctx.proc.userData.vad as silero.VAD,
      keyterms: buildKeyterms(agent.businessName, services.map((s) => s.name)),
    });

    // 7. Create and start session
    const session = new voice.AgentSession(sessionOptions);

    await session.start({
      agent: new ReceptionistAgent(deps),
      room: ctx.room,
      inputOptions,
    });

    // 8. Per-turn latency accounting. Registered before the greeting so the
    //    first turn is captured. See metrics.ts — until this existed, every
    //    latency claim about this agent was inference rather than measurement.
    const callMetrics = new CallMetrics();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      callMetrics.record(ev.metrics);
    });

    // 9. Surface pipeline failures. Without this an LLM/STT/TTS error is
    //    swallowed: a 402 from the model provider showed up only as a
    //    suspiciously fast performLLMInference and an agent that never spoke,
    //    with nothing in the logs to say why. A receptionist that cannot think
    //    should be loud about it.
    // 8b. Speech lifecycle, for diagnosing a reply that is generated and never
    //     heard. Twice in a browser test session the agent found appointment
    //     times, wrote the sentence, and said nothing until the caller prodded
    //     it — and the logs could not say which gate swallowed it.
    //
    //     A reply must clear three of them before it plays: the handle has to be
    //     scheduled, then authorised, then (when interruptions are allowed) the
    //     user has to be silent. Any one failing looks identical from outside:
    //     silence. These three events name which.
    //
    //     `agent_false_interruption` is the one to watch in a browser session.
    //     A laptop plays the agent through its speakers and hears it back on the
    //     mic; telephony noise cancellation is deliberately not applied there
    //     (it is tuned for 8kHz phone audio), so the agent can interrupt itself.
    session.on(voice.AgentSessionEventTypes.SpeechCreated, (ev) => {
      console.log(
        `[speech] created call=${callId} source=${ev.source ?? "?"} ` +
          `userInitiated=${ev.userInitiated ?? "?"}`
      );
    });

    session.on(voice.AgentSessionEventTypes.AgentFalseInterruption, () => {
      console.warn(
        `[speech] FALSE INTERRUPTION call=${callId} — the agent was cut off by ` +
          `something that turned out not to be the caller. On a laptop this is ` +
          `usually the agent's own voice returning through the microphone.`
      );
    });

    session.on(voice.AgentSessionEventTypes.OverlappingSpeech, (ev) => {
      console.log(`[speech] overlap call=${callId} ${JSON.stringify(ev)}`);
    });

    session.on(voice.AgentSessionEventTypes.Error, (ev) => {
      const err = ev.error;
      // InterruptionDetectionError carries no nested `error`, unlike the
      // STT/TTS/LLM variants.
      const cause = "error" in err ? err.error : err;
      console.error(
        `[worker] PIPELINE ERROR call=${callId} agent=${agent.id} ` +
          `type=${err.type} source=${ev.source?.label ?? "unknown"} ` +
          `recoverable=${err.recoverable}:`,
        cause instanceof Error ? cause.message : cause
      );
    });

    // 10. Register close handler BEFORE any async work — prevents race conditions
    let egressId: string | null = null;
    // Set only when egress actually starts. Computing it unconditionally lets a
    // failed startCallRecording still write a recording_url, and the dashboard
    // then hands out a presigned URL to an object nobody uploaded (PLAN.md
    // 1.8.2).
    let callRecordingKey: string | null = null;

    session.on(voice.AgentSessionEventTypes.Close, async (ev: voice.CloseEvent) => {
      try {
        if (egressId) {
          // Awaited: this handler may be the last thing running before the
          // process exits, and a dropped promise leaves the egress billing.
          await stopEgressWithRetry(egressId);
        }

        callMetrics.logSummary(callId, agent.id);

        // Test sessions skip DB finalization — no call row was created
        if (isTestSession) {
          console.log(`[worker] test session ${callId} ended`);
          return;
        }

        const transcript = extractTranscript(session.history);
        const isAbandoned =
          ev.reason === voice.CloseReason.PARTICIPANT_DISCONNECTED && transcript.length <= 1;

        const summary = await generateCallSummary(transcript);

        let outcome: CallOutcome;
        if (ev.reason === voice.CloseReason.ERROR) outcome = "error";
        else if (isAbandoned) outcome = "abandoned";
        else if (callState.wasBooked) outcome = "booked";
        else if (callState.wasEscalated) outcome = "escalated";
        else outcome = "answered";

        await finishCall(callId, {
          outcome,
          transcript,
          summary,
          recordingKey: callRecordingKey,
        });

        console.log(`[worker] call ${callId} finalized: ${outcome}`);
      } catch (err) {
        console.error("[worker] CRITICAL: close handler failed — call not finalized:", callId, err);
        // Without this the row keeps a null outcome and null ended_at, which is
        // indistinguishable from a call still in progress. Best-effort: if this
        // write fails too there is nothing further to try.
        if (!isTestSession) {
          await finishCall(callId, {
            outcome: "error",
            transcript: [],
            summary: null,
            recordingKey: callRecordingKey,
          }).catch((writeErr: unknown) =>
            console.error("[worker] could not mark call as errored:", callId, writeErr)
          );
        }
      }
    });

    // 9. ── GREETING ──────────────────────────────────────────────────────────
    // The disclosure leads on test sessions too, so the owner hears what their
    // callers hear. `recording` is false when storage is unconfigured, so the
    // wording never claims a recording that cannot happen.
    const recording = recordingEnabled(agent);
    const greeting = buildGreeting(agent.greeting, recording);
    session.say(greeting.text, {
      allowInterruptions: false,
    });

    // 10. Recording + DB writes — skipped for test sessions
    if (!isTestSession) {
      // With recording off, egressId and callRecordingKey stay null and
      // finishCall writes no recording_url, which the dashboard reads as no audio.
      if (recording) {
        startCallRecording(roomName, callId)
          .then((result) => {
            egressId = result.egressId;
            callRecordingKey = result.recordingKey;
            console.log(`[worker] egress started: ${egressId}`);
          })
          .catch((err: unknown) => {
            // callRecordingKey stays null, so finishCall writes no recording_url.
            console.error("[worker] failed to start recording:", err);
          });
      } else {
        console.log(`[worker] recording off for agent ${agent.id}`);
      }

      // upsertCaller + createCall run concurrently WHILE greeting plays
      let caller: Awaited<ReturnType<typeof upsertCaller>> = null;
      try {
        [caller] = await Promise.all([
          upsertCaller(agent.id, callerPhone),
          createCall({
            id: callId,
            agentId: agent.id,
            callerId: null,
            callerPhone,
            roomName: roomName,
            disclosureVersion: greeting.version,
          }),
        ]);
        markCallRowReady(true);
      } catch (err) {
        // Unblock anything awaiting the row rather than leaving tools hanging
        // for the rest of the call. They fall back to an unlinked escalation.
        markCallRowReady(false);
        console.error("[worker] call row creation failed:", callId, err);
        throw err;
      }

      deps.caller = caller;
      // No client row for an anonymous caller, so nothing to backfill.
      if (caller) {
        db.update(callsTable)
          .set({ callerId: caller.id })
          .where(eq(callsTable.id, callId))
          .catch((err: unknown) => console.error("[worker] callerId backfill failed:", err));
      }
    }

    // 11. Control returns to LiveKit framework — participant speaks, tools fire
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "receptionist",
  })
);
