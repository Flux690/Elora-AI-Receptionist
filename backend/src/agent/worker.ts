import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  llm,
  voice,
} from "@livekit/agents";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import { createClerkClient } from "@clerk/backend";
import { ParticipantKind } from "@livekit/rtc-node";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { env } from "../env.js";
import { upsertClient, resolveClientByPhone, type ClientRow } from "../services/clients.js";
import { createCall, finishCall } from "../services/calls.js";
import { createEscalation } from "../services/escalations.js";
import { searchKnowledge } from "../services/knowledge.js";
import { resolveTenantByCalledNumber, getTenantById, type TenantRow } from "../services/tenants.js";
import { createAppointment } from "../services/appointments.js";
import { checkAvailability, createCalendarEvent } from "../services/calendar.js";

// ---------------------------------------------------------------------------
// Agent context — everything the agent needs, closed over at dispatch time
// ---------------------------------------------------------------------------

type AgentDeps = {
  tenant: TenantRow;
  client: ClientRow | null;
  callerPhone: string;
  callId: string;
  googleAccessToken: string | null;
  googleCalendarId: string | null;
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basePrompt = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");

function buildSystemPrompt(deps: AgentDeps): string {
  const { tenant, client } = deps;

  const callerBlock = client?.name
    ? `Caller: ${client.name} (returning client, phone: ${deps.callerPhone})`
    : `Caller: unknown (phone: ${deps.callerPhone})`;

  const profileSummary = Object.entries(tenant.businessProfile ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const calendarBlock = deps.googleCalendarId
    ? "Calendar: connected — use checkAvailability before offering times, use bookAppointment to confirm."
    : "Calendar: not connected — if caller wants to book, create an escalation so the team follows up.";

  return `${basePrompt}

## Business context
Name: ${tenant.name}
Timezone: ${tenant.timezone}
${profileSummary}

## Caller context
${callerBlock}

## Booking
${calendarBlock}

## Additional Instructions
${tenant.additionalInstructions}`.trim();
}

// ---------------------------------------------------------------------------
// Agent class with tools
// ---------------------------------------------------------------------------

class Agent extends voice.Agent {
  constructor(deps: AgentDeps) {
    super({
      instructions: buildSystemPrompt(deps),
      tools: {
        searchKnowledge: llm.tool({
          description:
            "Search the knowledge base for an answer to a caller's question about the business — services, pricing, hours, policies, or anything else not already known from context.",
          parameters: z.object({
            query: z.string().describe("The caller's question, verbatim or closely paraphrased."),
          }),
          execute: async ({ query }) => {
            const results = await searchKnowledge(deps.tenant.id, query);
            if (results.length === 0) return null;
            return results.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join("\n---\n");
          },
        }),

        createEscalation: llm.tool({
          description:
            "Escalate a question you cannot answer to the business team. Use this when search_knowledge returns nothing useful and you cannot answer from context. Do not escalate the same question twice.",
          parameters: z.object({
            question: z.string().describe("The caller's question, as asked."),
            transcriptExcerpt: z
              .string()
              .nullable()
              .describe("A short excerpt of recent conversation for context."),
          }),
          execute: async ({ question, transcriptExcerpt }, { ctx }) => {
            ctx.speechHandle.allowInterruptions = false;
            await createEscalation({
              tenantId: deps.tenant.id,
              callId: deps.callId,
              clientId: deps.client?.id ?? null,
              callerPhone: deps.callerPhone,
              question,
              transcriptExcerpt,
            });
            return { escalated: true };
          },
        }),

        checkAvailability: llm.tool({
          description:
            "Check available appointment slots on the business calendar. Always call this before offering specific times to a caller who wants to book.",
          parameters: z.object({
            service: z.string().describe("The service the caller wants to book."),
            startIso: z
              .string()
              .describe(
                "Start of the search window in ISO 8601 format, adjusted to the business timezone."
              ),
            endIso: z
              .string()
              .describe("End of the search window in ISO 8601 format."),
          }),
          execute: async ({ startIso, endIso }) => {
            if (!deps.googleAccessToken || !deps.googleCalendarId) {
              return {
                error:
                  "Calendar not connected. Create an escalation so the team can follow up with the caller.",
              };
            }
            try {
              const slots = await checkAvailability(
                deps.googleAccessToken,
                deps.googleCalendarId,
                startIso,
                endIso
              );
              return { available: slots.slice(0, 5) };
            } catch (err) {
              console.error("[agent] checkAvailability failed:", err);
              return { error: "Could not check availability. Create an escalation." };
            }
          },
        }),

        bookAppointment: llm.tool({
          description:
            "Book a confirmed appointment after the caller has chosen a specific slot. Do not call this until the caller has explicitly confirmed the time.",
          parameters: z.object({
            service: z.string().describe("The service being booked."),
            startIso: z.string().describe("Confirmed slot start in ISO 8601."),
            endIso: z.string().describe("Confirmed slot end in ISO 8601."),
          }),
          execute: async ({ service, startIso, endIso }) => {
            if (!deps.googleAccessToken || !deps.googleCalendarId) {
              await createAppointment({
                tenantId: deps.tenant.id,
                clientId: deps.client?.id ?? null,
                callerPhone: deps.callerPhone,
                service,
                startTime: new Date(startIso),
                endTime: new Date(endIso),
                status: "requested",
              });
              return {
                booked: false,
                reason: "Calendar not connected — appointment request saved, team will confirm.",
              };
            }
            try {
              const eventId = await createCalendarEvent(
                deps.googleAccessToken,
                deps.googleCalendarId,
                {
                  summary: `${service} — ${deps.client?.name ?? deps.callerPhone}`,
                  startIso,
                  endIso,
                  timezone: deps.tenant.timezone,
                }
              );
              await createAppointment({
                tenantId: deps.tenant.id,
                clientId: deps.client?.id ?? null,
                callerPhone: deps.callerPhone,
                service,
                startTime: new Date(startIso),
                endTime: new Date(endIso),
                status: "confirmed",
                googleEventId: eventId,
              });
              await finishCall(deps.callId, "booked");
              return { booked: true, eventId };
            } catch (err) {
              console.error("[agent] bookAppointment failed:", err);
              await createAppointment({
                tenantId: deps.tenant.id,
                clientId: deps.client?.id ?? null,
                callerPhone: deps.callerPhone,
                service,
                startTime: new Date(startIso),
                endTime: new Date(endIso),
                status: "requested",
              });
              return {
                booked: false,
                reason: "Booking failed — appointment request saved, team will confirm.",
              };
            }
          },
        }),

        endCall: llm.tool({
          description:
            "End the phone call. Use only after the caller has clearly indicated they are done — for example, said goodbye, thank you, or that's all.",
          parameters: z.object({
            reason: z.string().describe("Brief reason the call is ending."),
          }),
          execute: async ({ reason }, { ctx }) => {
            await finishCall(deps.callId, "answered");
            await ctx.session.generateReply({
              userInput: `You are about to end the call due to ${reason}, notify the user with one last message`,
            });
            ctx.session.shutdown({ reason });
          },
        }),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Worker entry
// ---------------------------------------------------------------------------

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    // Try metadata-first resolution (per-tenant dispatch rules)
    let tenant: TenantRow | null = null;
    try {
      const meta = ctx.job.metadata ? JSON.parse(ctx.job.metadata) : null;
      if (meta?.tenantId) {
        tenant = await getTenantById(meta.tenantId);
        if (tenant) console.log(`[worker] resolved tenant from metadata: ${tenant.id}`);
      }
    } catch {
      // malformed metadata — fall through to phone number lookup
    }

    await ctx.connect();

    const roomName = ctx.room.name ?? "";
    const participant = await ctx.waitForParticipant();

    const callerPhone =
      participant.kind === ParticipantKind.SIP
        ? (participant.attributes["sip.phoneNumber"] ?? "unknown")
        : "dev-participant";

    // Fallback: resolve by trunk phone number (platform-wide dispatch rule)
    if (!tenant) {
      const calledNumber =
        participant.kind === ParticipantKind.SIP
          ? (participant.attributes["sip.trunkPhoneNumber"] ?? "")
          : "";
      tenant = calledNumber ? await resolveTenantByCalledNumber(calledNumber) : null;
    }

    if (!tenant) {
      console.error("[worker] No tenant resolved — dropping call");
      return;
    }

    const [client, , googleAccessToken] = await Promise.all([
      resolveClientByPhone(tenant.id, callerPhone),
      upsertClient(tenant.id, callerPhone),
      tenant.googleCalendarId && tenant.clerkUserId
        ? clerkClient.users
            .getUserOauthAccessToken(tenant.clerkUserId, "oauth_google")
            .then((r) => r.data[0]?.token ?? null)
            .catch((err) => {
              console.error("[worker] Failed to fetch Google OAuth token:", err);
              return null;
            })
        : Promise.resolve(null),
    ]);

    const call = await createCall({
      tenantId: tenant.id,
      clientId: client?.id ?? null,
      callerPhone,
      livekitRoomName: roomName,
    });

    const deps: AgentDeps = {
      tenant,
      client,
      callerPhone,
      callId: call.id,
      googleAccessToken,
      googleCalendarId: tenant.googleCalendarId ?? null,
    };

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: new inference.STT({ model: "assemblyai/universal-streaming", language: "en" }),
      llm: new openai.LLM({
        model: env.LLM_MODEL,
        baseURL: env.OPENROUTER_BASE_URL,
        apiKey: env.OPENROUTER_API_KEY,
      }),
      tts: new inference.TTS({
        model: "cartesia/sonic-3",
        voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      }),
      turnHandling: {
        turnDetection: new livekit.turnDetector.MultilingualModel(),
      },
    });

    await session.start({ agent: new Agent(deps), room: ctx.room });

    const greeting =
      client?.name
        ? `Hi ${client.name}, welcome back to ${tenant.name}. How can I help you today?`
        : `Hi, you've reached ${tenant.name}. How can I help you today?`;

    await session.say(greeting);
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "receptionist",
  })
);
