import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  voice,
} from "@livekit/agents";
import * as silero from "@livekit/agents-plugin-silero";
import { createClerkClient } from "@clerk/backend";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import type { CallOutcome } from "@receptionist/shared";
import { env } from "../env.js";
import { db, startDbKeepWarm } from "../db/client.js";
import { calls as callsTable } from "../db/schema.js";
import { upsertClient } from "../services/clients.js";
import { createCall, finishCall } from "../services/calls.js";
import { getTenantById, getTenantByPhoneNumber } from "../services/tenants.js";
import { listKnowledgeForPrompt } from "../services/knowledge.js";
import { startCallRecording, stopCallRecording } from "../services/storage.js";
import type { AgentDeps, CallState } from "./types.js";
import type { KnowledgeEntry } from "./prompt.js";
import { buildSessionConfig, buildKeyterms } from "./session-config.js";
import { resolveCallerPhone } from "./caller.js";
import { ReceptionistAgent } from "./receptionist.js";
import { CallMetrics } from "./metrics.js";
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

type ResolvedTenant = {
  tenant: import("../services/tenants.js").WorkerTenant;
  knowledge: KnowledgeEntry[];
};

// Tenant and knowledge are cached together: both are read on every call, both
// go into the system prompt, and both should expire at the same moment so a
// config change and a new knowledge item propagate on the same 5-minute cycle.
const tenantCache = new LRUCache<string, ResolvedTenant & { expiresAt: number }>(500);

async function resolveTenant(idOrPhone: {
  tenantId?: string;
  phoneNumber?: string;
}): Promise<ResolvedTenant | null> {
  const cacheKey = idOrPhone.tenantId ?? idOrPhone.phoneNumber ?? "";
  if (!cacheKey) return null;

  const cached = tenantCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { tenant: cached.tenant, knowledge: cached.knowledge };
  }

  const tenant = idOrPhone.tenantId
    ? await getTenantById(idOrPhone.tenantId)
    : await getTenantByPhoneNumber(idOrPhone.phoneNumber!);

  if (!tenant) return null;

  // Second round trip on a cache miss only. The tenant id is not known until
  // the first query resolves, so these cannot be parallelised on the
  // phone-number path.
  const knowledge = await listKnowledgeForPrompt(tenant.id);

  tenantCache.set(cacheKey, {
    tenant,
    knowledge,
    expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
  });
  return { tenant, knowledge };
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
    // Keeps the pg pool warm and the Neon compute out of autosuspend, so the
    // first call after a quiet spell does not pay a cold start before the
    // greeting. See startDbKeepWarm() for why this is an experiment.
    startDbKeepWarm();
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

    // 2. Resolve tenant. This DOES block the critical path on a cache miss —
    //    the first call after a restart or a 5-minute gap awaits a DB round trip
    //    before session.start(), so the caller hears silence for its duration.
    //    Mitigated by the LRU below and by startDbKeepWarm() keeping the pool and
    //    the Neon compute alive; not eliminated. (The previous comment here
    //    claimed "zero blocking DB work on the critical path", 14 lines above an
    //    awaited lookup.)
    let resolved: ResolvedTenant | null = null;

    if (isTestSession) {
      const tenantId = participant.attributes["tenantId"];
      if (!tenantId) {
        console.error("[worker] no tenantId in participant attributes for test session — dropping");
        return;
      }
      resolved = await resolveTenant({ tenantId });
    } else {
      if (!trunkPhone) {
        console.error(`[worker] No trunkPhoneNumber found for SIP participant — dropping`);
        return;
      }
      resolved = await resolveTenant({ phoneNumber: trunkPhone });
    }

    if (!resolved) {
      console.error(`[worker] tenant not found — dropping`);
      return;
    }
    const { tenant, knowledge } = resolved;
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
      tenant,
      client: null,
      callerPhone,
      callId,
      getGoogleToken: () => tokenPromise,
      googleCalendarId: tenant.googleCalendarId ?? null,
      knowledge,
      callRowReady,
      callState,
    };

    // 6. Build the pipeline. See session-config.ts for why turnDetection is
    //    left unset and why noise cancellation is SIP-only.
    const { sessionOptions, inputOptions } = buildSessionConfig({
      isTestSession,
      vad: ctx.proc.userData.vad as silero.VAD,
      keyterms: buildKeyterms(tenant.name, tenant.services.map((s) => s.name)),
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
    session.on(voice.AgentSessionEventTypes.Error, (ev) => {
      const err = ev.error;
      // InterruptionDetectionError carries no nested `error`, unlike the
      // STT/TTS/LLM variants.
      const cause = "error" in err ? err.error : err;
      console.error(
        `[worker] PIPELINE ERROR call=${callId} tenant=${tenant.id} ` +
          `type=${err.type} source=${ev.source?.label ?? "unknown"} ` +
          `recoverable=${err.recoverable}:`,
        cause instanceof Error ? cause.message : cause
      );
    });

    // 10. Register close handler BEFORE any async work — prevents race conditions
    let egressId: string | null = null;
    // Set only when egress actually starts. Previously computed unconditionally,
    // so a failed startCallRecording still wrote a recording_url and the
    // dashboard handed out a presigned URL to an object that was never uploaded
    // (PLAN.md 1.8.2).
    let callRecordingKey: string | null = null;

    session.on(voice.AgentSessionEventTypes.Close, async (ev: voice.CloseEvent) => {
      try {
        if (egressId) {
          // Awaited: this handler may be the last thing running before the
          // process exits, and a dropped promise leaves the egress billing.
          await stopEgressWithRetry(egressId);
        }

        callMetrics.logSummary(callId, tenant.id);

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
          recordingUrl: callRecordingKey,
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
            recordingUrl: callRecordingKey,
          }).catch((writeErr: unknown) =>
            console.error("[worker] could not mark call as errored:", callId, writeErr)
          );
        }
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
          callRecordingKey = result.recordingKey;
          console.log(`[worker] egress started: ${egressId}`);
        })
        .catch((err: unknown) => {
          // callRecordingKey stays null, so finishCall writes no recording_url.
          console.error("[worker] failed to start recording:", err);
        });

      // upsertClient + createCall run concurrently WHILE greeting plays
      let client: Awaited<ReturnType<typeof upsertClient>> = null;
      try {
        [client] = await Promise.all([
          upsertClient(tenant.id, callerPhone),
          createCall({
            id: callId,
            tenantId: tenant.id,
            clientId: null,
            callerPhone,
            livekitRoomName: roomName,
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

      deps.client = client;
      // No client row for an anonymous caller, so nothing to backfill.
      if (client) {
        db.update(callsTable)
          .set({ clientId: client.id })
          .where(eq(callsTable.id, callId))
          .catch((err: unknown) => console.error("[worker] clientId backfill failed:", err));
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
