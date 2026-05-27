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
import { eq } from "drizzle-orm";
import type { CallOutcome } from "@receptionist/shared";
import { env } from "../env.js";
import { db } from "../db/client.js";
import { calls as callsTable } from "../db/schema.js";
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
    // 1. Connect + wait for SIP participant
    await ctx.connect();
    const roomName = ctx.room.name ?? "";
    const participant = await ctx.waitForParticipant();

    const isSip = participant.kind === ParticipantKind.SIP;
    const callerPhone = isSip ? (participant.attributes["sip.phoneNumber"] ?? "unknown") : "dev-participant";
    const rawTrunk = isSip ? (participant.attributes["sip.trunkPhoneNumber"] ?? "") : "";
    const trunkPhone = rawTrunk && !rawTrunk.startsWith("+") ? `+${rawTrunk}` : rawTrunk;

    // 2. Resolve tenant — the ONLY query on the critical path for the greeting
    const tenant = trunkPhone ? await getTenantByPhoneNumber(trunkPhone) : null;
    if (!tenant) {
      console.error(`[worker] No tenant for trunkPhoneNumber="${rawTrunk}" (normalized: "${trunkPhone}") — dropping call`);
      return;
    }
    console.log(`[worker] resolved tenant: ${tenant.id}`);

    // 3. Fire Google OAuth token fetch in background (no await — resolves while greeting plays)
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

    // 4. Generate callId locally — zero DB roundtrip needed
    //    crypto.randomUUID() produces a valid UUID v4 without touching Postgres
    const callId = crypto.randomUUID();

    // 5. Build deps immediately with what we have.
    //    client starts null — set after upsertClient resolves (step 10).
    //    Tools fire only after caller speaks + LLM responds, so client will
    //    always be populated by the time any tool execute() runs.
    const callState: CallState = { wasBooked: false, wasEscalated: false };
    const deps: AgentDeps = {
      tenant,
      client: null,
      callerPhone,
      callId,
      getGoogleToken: () => tokenPromise,
      googleCalendarId: tenant.googleCalendarId ?? null,
      callState,
    };

    // 6. Create TTS instance
    const agentTts = new inference.TTS({
      model: "cartesia/sonic-3",
      voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
    });

    // 7. Create and start session
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

    await session.start({
      agent: new ReceptionistAgent(deps),
      room: ctx.room,
    });

    // 8. Register close handler BEFORE any async work — prevents race conditions
    let egressId: string | null = null;
    const callRecordingKey = recordingKey(callId);

    session.on(voice.AgentSessionEventTypes.Close, async (ev: voice.CloseEvent) => {
      try {
        if (egressId) {
          stopCallRecording(egressId).catch((err: unknown) =>
            console.error("[worker] stop egress:", err)
          );
        }

        const transcript = extractTranscript(session.history);
        const isAbandoned =
          ev.reason === voice.CloseReason.PARTICIPANT_DISCONNECTED && transcript.length <= 1;

        const summary = await generateCallSummary(transcript, {
          model: env.LLM_MODEL,
          baseURL: env.OPENROUTER_BASE_URL,
          apiKey: env.OPENROUTER_API_KEY,
        });

        let outcome: CallOutcome;
        if (isAbandoned) outcome = "abandoned";
        else if (callState.wasBooked) outcome = "booked";
        else if (callState.wasEscalated) outcome = "escalated";
        else outcome = "answered";

        await finishCall(callId, {
          outcome,
          wasBooked: callState.wasBooked,
          wasEscalated: callState.wasEscalated,
          transcript,
          summary,
          recordingUrl: callRecordingKey,
        });

        console.log(`[worker] call ${callId} finalized: ${outcome}`);
      } catch (err) {
        console.error("[worker] CRITICAL: close handler failed — call not finalized:", callId, err);
      }
    });

    // 9. ── GREETING + RECORDING START SIMULTANEOUSLY ──────────────────────
    //    Both fire here, before any DB awaits. Recording must start NOW to
    //    capture the full greeting — starting it after Promise.all would miss
    //    the first 200-600ms of audio while upsertClient/createCall resolve.
    const greeting = tenant.agentProfile.greeting;
    if (greeting) {
      session.say(greeting, { allowInterruptions: false });
    }

    // Start recording immediately — only needs roomName and callId, both
    // already known. Does NOT need createCall to finish first.
    startCallRecording(roomName, callId)
      .then((result) => {
        egressId = result.egressId;
        console.log(`[worker] egress started: ${egressId}`);
      })
      .catch((err: unknown) => {
        console.error("[worker] failed to start recording:", err);
      });

    // 10. upsertClient + createCall run concurrently WHILE greeting plays.
    //     Both will finish well before the caller finishes speaking and any
    //     tool fires (that chain is: caller speaks → VAD → STT → LLM → tool,
    //     which takes at minimum 3-8 seconds after the greeting ends).
    const [client] = await Promise.all([
      upsertClient(tenant.id, callerPhone),
      createCall({
        id: callId,          // our locally-generated UUID
        tenantId: tenant.id,
        clientId: null,      // backfilled below after client resolves
        callerPhone,
        livekitRoomName: roomName,
      }),
    ]);

    // Populate client into deps and backfill the FK in the background
    deps.client = client;
    db.update(callsTable)
      .set({ clientId: client.id })
      .where(eq(callsTable.id, callId))
      .catch((err: unknown) => console.error("[worker] clientId backfill failed:", err));

    // 11. Control returns to LiveKit framework — caller speaks, tools fire
  },
});

// Agent class — receives deps, builds prompt and tools
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
