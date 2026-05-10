import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from "@livekit/agents";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import { createClerkClient } from "@clerk/backend";
import { ParticipantKind } from "@livekit/rtc-node";
import { fileURLToPath } from "node:url";
import type { CallOutcome } from "@receptionist/shared";
import { env } from "../env.js";
import { upsertClient } from "../services/clients.js";
import { createCall, finishCall } from "../services/calls.js";
import { getTenantByPhoneNumber } from "../services/tenants.js";
import { startCallRecording, stopCallRecording, recordingKey } from "../services/storage.js";
import type { AgentDeps, CallState } from "./types.js";
import { buildSystemPrompt } from "./prompt.js";
import { createAgentTools } from "./tools.js";
import { extractTranscript } from "./transcript.js";
import { generateCallSummary } from "./summary.js";

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    // 1. Connect + wait for participant
    await ctx.connect();
    const roomName = ctx.room.name ?? "";
    const participant = await ctx.waitForParticipant();

    const isSip = participant.kind === ParticipantKind.SIP;
    const callerPhone = isSip ? (participant.attributes["sip.phoneNumber"] ?? "unknown") : "dev-participant";
    const rawTrunk = isSip ? (participant.attributes["sip.trunkPhoneNumber"] ?? "") : "";
    const trunkPhone = rawTrunk && !rawTrunk.startsWith("+") ? `+${rawTrunk}` : rawTrunk;

    // 2. Resolve tenant by the number that was dialed
    const tenant = trunkPhone ? await getTenantByPhoneNumber(trunkPhone) : null;
    if (!tenant) {
      console.error(`[worker] No tenant for trunkPhoneNumber="${rawTrunk}" (normalized: "${trunkPhone}") — dropping call`);
      return;
    }
    console.log(`[worker] resolved tenant: ${tenant.id}`);

    // 5. Fire background Google OAuth token fetch (no await)
    const tokenPromise: Promise<string | null> =
      tenant.googleCalendarId && tenant.clerkUserId
        ? clerkClient.users
            .getUserOauthAccessToken(tenant.clerkUserId, "google")
            .then((r) => r.data[0]?.token ?? null)
            .catch((err: unknown) => {
              console.error("[worker] Failed to fetch Google OAuth token:", err);
              return null;
            })
        : Promise.resolve(null);

    // 6. Upsert client (single query, returns full row)
    const client = await upsertClient(tenant.id, callerPhone);

    // 7-8. Build deps
    const callState: CallState = { wasBooked: false, wasEscalated: false };
    const deps: AgentDeps = {
      tenant,
      client,
      callerPhone,
      callId: "",
      getGoogleToken: () => tokenPromise,
      googleCalendarId: tenant.googleCalendarId ?? null,
      callState,
    };

    // 9. Create session
    const agentTts = new inference.TTS({
      model: "cartesia/sonic-3",
      voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
    });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: new inference.STT({ model: "assemblyai/universal-streaming", language: "en" }),
      llm: new openai.LLM({
        model: env.LLM_MODEL,
        baseURL: env.OPENROUTER_BASE_URL,
        apiKey: env.OPENROUTER_API_KEY,
      }),
      tts: agentTts,
      turnHandling: {
        turnDetection: new livekit.turnDetector.MultilingualModel(),
        preemptiveGeneration: { preemptiveTts: true },
      },
    });

    // 10. Start session
    await session.start({
      agent: new ReceptionistAgent(deps),
      room: ctx.room,
    });

    // 11. IMMEDIATELY register close handler (before createCall — prevents race)
    let egressId: string | null = null;
    let callRecordingKey: string | null = null;

    session.on(voice.AgentSessionEventTypes.Close, async (ev: voice.CloseEvent) => {
      if (!deps.callId) {
        console.warn("[worker] close fired before callId set — skipping finalization");
        return;
      }

      // Stop recording
      if (egressId) {
        stopCallRecording(egressId).catch((err: unknown) =>
          console.error("[worker] stop egress:", err)
        );
      }

      // Extract transcript + generate summary
      const transcript = extractTranscript(session.history);
      const isAbandoned =
        ev.reason === voice.CloseReason.PARTICIPANT_DISCONNECTED && transcript.length <= 1;

      const summary = await generateCallSummary(transcript, {
        model: env.LLM_MODEL,
        baseURL: env.OPENROUTER_BASE_URL,
        apiKey: env.OPENROUTER_API_KEY,
      });

      // Derive primary outcome
      let outcome: CallOutcome;
      if (isAbandoned) outcome = "abandoned";
      else if (callState.wasBooked) outcome = "booked";
      else if (callState.wasEscalated) outcome = "escalated";
      else outcome = "answered";

      await finishCall(deps.callId, {
        outcome,
        wasBooked: callState.wasBooked,
        wasEscalated: callState.wasEscalated,
        transcript,
        summary,
        recordingUrl: callRecordingKey,
      });

      console.log(`[worker] call ${deps.callId} finalized: ${outcome}`);
    });

    // 12. Create call record
    const call = await createCall({
      tenantId: tenant.id,
      clientId: client.id,
      callerPhone,
      livekitRoomName: roomName,
    });
    deps.callId = call.id;

    // 13. Fire egress + greeting in parallel
    callRecordingKey = recordingKey(call.id);
    startCallRecording(roomName, call.id)
      .then((result) => {
        egressId = result.egressId;
        console.log(`[worker] egress started: ${egressId}`);
      })
      .catch((err: unknown) => {
        console.error("[worker] failed to start recording:", err);
      });

    const greeting = tenant.agentProfile.greeting;
    if (greeting) {
      session.say(greeting);
    }

    // 14. Control returns to LiveKit framework — user speaks, tools fire
  },
});

// Agent class — receives deps, delegates prompt and tools
class ReceptionistAgent extends voice.Agent {
  constructor(deps: AgentDeps) {
    super({
      instructions: buildSystemPrompt(deps),
      tools: createAgentTools(deps),
    });
  }
}

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "receptionist",
  })
);
