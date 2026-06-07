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
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import type { CallOutcome } from "@receptionist/shared";
import { env } from "../env.js";
import { db } from "../db/client.js";
import { calls as callsTable } from "../db/schema.js";
import { upsertClient } from "../services/clients.js";
import { createCall, finishCall } from "../services/calls.js";
import { getTenantById, getTenantByPhoneNumber } from "../services/tenants.js";
import { startCallRecording, stopCallRecording, recordingKey } from "../services/storage.js";
import type { AgentDeps, CallState } from "./types.js";
import { buildSystemPrompt } from "./prompt.js";
import { createAgentTools } from "./tools.js";
import { extractTranscript } from "./transcript.js";
import { generateCallSummary } from "./summary.js";

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// ── LRU cache ─────────────────────────────────────────────────────────────────
// Map preserves insertion order, so the first key is always the least-recently-used.
class LRUCache<K, V> {
  private readonly map = new Map<K, V>();
  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) this.map.delete(this.map.keys().next().value as K);
    this.map.set(key, value);
  }
}

// ── Tenant cache ──────────────────────────────────────────────────────────────
// 5-minute TTL so config changes propagate without a restart.
// Capped at 500 entries to prevent unbounded memory growth in production.
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000;
const tenantCache = new LRUCache<string, { data: import("../services/tenants.js").WorkerTenant; expiresAt: number }>(500);

async function resolveTenant(idOrPhone: { tenantId?: string; phoneNumber?: string }) {
  const cacheKey = idOrPhone.tenantId ?? idOrPhone.phoneNumber ?? "";
  if (!cacheKey) return null;

  const cached = tenantCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const tenant = idOrPhone.tenantId
    ? await getTenantById(idOrPhone.tenantId)
    : await getTenantByPhoneNumber(idOrPhone.phoneNumber!);

  if (tenant) tenantCache.set(cacheKey, { data: tenant, expiresAt: Date.now() + TENANT_CACHE_TTL_MS });
  return tenant;
}

// ── Google OAuth token cache ──────────────────────────────────────────────────
// Google access tokens are valid for 60 minutes; cache for 50 to avoid expiry
// races. Clerk refreshes under the hood when we call getUserOauthAccessToken —
// caching skips that network round-trip on every inbound call.
const OAUTH_TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;
const oauthTokenCache = new LRUCache<string, { token: string; expiresAt: number }>(200);

async function getGoogleOAuthToken(clerkUserId: string): Promise<string | null> {
  const cached = oauthTokenCache.get(clerkUserId);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  try {
    const r = await clerkClient.users.getUserOauthAccessToken(clerkUserId, "google");
    const token = r.data[0]?.token ?? null;
    if (token) oauthTokenCache.set(clerkUserId, { token, expiresAt: Date.now() + OAUTH_TOKEN_CACHE_TTL_MS });
    return token;
  } catch (err) {
    console.error("[worker] Failed to fetch Google OAuth token:", err);
    return null;
  }
}

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

    const callerPhone = !isTestSession ? (participant.attributes["sip.phoneNumber"] ?? "unknown") : "test";
    const rawTrunk = !isTestSession ? (participant.attributes["sip.trunkPhoneNumber"] ?? "") : "";
    const trunkPhone = rawTrunk && !rawTrunk.startsWith("+") ? `+${rawTrunk}` : rawTrunk;

    // 2. Resolve tenant — zero blocking DB work on the critical path.
    let tenant: import("../services/tenants.js").WorkerTenant | null = null;

    if (isTestSession) {
      const tenantId = participant.attributes["tenantId"];
      if (!tenantId) {
        console.error("[worker] no tenantId in participant attributes for test session — dropping");
        return;
      }
      tenant = await resolveTenant({ tenantId });
    } else {
      if (!trunkPhone) {
        console.error(`[worker] No trunkPhoneNumber found for SIP participant — dropping`);
        return;
      }
      tenant = await resolveTenant({ phoneNumber: trunkPhone });
    }

    if (!tenant) {
      console.error(`[worker] tenant not found — dropping`);
      return;
    }
    console.log(`[worker] resolved tenant: ${tenant.id}${isTestSession ? " (test session)" : ""}`);

    // 3. Fire Google OAuth token fetch in background (no await — resolves while greeting plays).
    //    Token is cached at module level with a 50-minute TTL so repeat calls skip the network.
    const tokenPromise: Promise<string | null> =
      tenant.googleCalendarId && tenant.clerkUserId
        ? getGoogleOAuthToken(tenant.clerkUserId)
        : Promise.resolve(null);

    // 4. Generate callId locally — zero DB roundtrip needed
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
    const callRecordingKey = isTestSession ? null : recordingKey(callId);

    session.on(voice.AgentSessionEventTypes.Close, async (ev: voice.CloseEvent) => {
      try {
        if (egressId) {
          stopEgressWithRetry(egressId);
        }

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
        if (isAbandoned) outcome = "abandoned";
        else if (callState.wasBooked) outcome = "booked";
        else if (callState.wasEscalated) outcome = "escalated";
        else outcome = "answered";

        await finishCall(callId, {
          outcome,
          transcript,
          summary,
          recordingUrl: callRecordingKey,
        });

        console.log(`[worker] call ${callId} finalized: ${outcome}`);
      } catch (err) {
        console.error("[worker] CRITICAL: close handler failed — call not finalized:", callId, err);
      }
    });

    // 9. ── GREETING ──────────────────────────────────────────────────────────
    const greeting = tenant.agentProfile.greeting;
    if (greeting) {
      session.say(greeting, { allowInterruptions: false });
    }

    // 10. Recording + DB writes — skipped for test sessions
    if (!isTestSession) {
      // Start recording simultaneously with greeting
      startCallRecording(roomName, callId)
        .then((result) => {
          egressId = result.egressId;
          console.log(`[worker] egress started: ${egressId}`);
        })
        .catch((err: unknown) => {
          console.error("[worker] failed to start recording:", err);
        });

      // upsertClient + createCall run concurrently WHILE greeting plays
      const [client] = await Promise.all([
        upsertClient(tenant.id, callerPhone),
        createCall({
          id: callId,
          tenantId: tenant.id,
          clientId: null,
          callerPhone,
          livekitRoomName: roomName,
        }),
      ]);

      deps.client = client;
      db.update(callsTable)
        .set({ clientId: client.id })
        .where(eq(callsTable.id, callId))
        .catch((err: unknown) => console.error("[worker] clientId backfill failed:", err));
    }

    // 11. Control returns to LiveKit framework — participant speaks, tools fire
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
