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
import { resolveTenantByCalledNumber, type TenantRow } from "../services/tenants.js";

// ---------------------------------------------------------------------------
// Agent context — everything the agent needs, closed over at dispatch time
// ---------------------------------------------------------------------------

type AgentDeps = {
  tenant: TenantRow;
  client: ClientRow | null;
  callerPhone: string;
  callId: string;
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

  return `${basePrompt}

## Business context
Name: ${tenant.name}
Timezone: ${tenant.timezone}
${profileSummary}

## Caller context
${callerBlock}

## Additional Rules
${tenant.systemPrompt}`.trim();
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
            return results.map((r) => r.chunkText).join("\n---\n");
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

        endCall: llm.tool({
          description:
            "End the phone call. Use only after the caller has clearly indicated they are done — for example, said goodbye, thank you, or that's all.",
          parameters: z.object({
            reason: z.string().describe("Brief reason the call is ending."),
          }),
          execute: async ({ reason }, { ctx }) => {
            await finishCall(deps.callId, "answered");
            await ctx.session.generateReply({
              instructions: "Say a brief, warm goodbye to the caller.",
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

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const roomName = ctx.room.name ?? "";
    const participant = await ctx.waitForParticipant();

    const callerPhone =
      participant.kind === ParticipantKind.SIP
        ? (participant.attributes["sip.phoneNumber"] ?? "unknown")
        : "dev-participant";

    const calledNumber =
      participant.kind === ParticipantKind.SIP
        ? (participant.attributes["sip.trunkPhoneNumber"] ?? "")
        : "";

    const tenant = calledNumber ? await resolveTenantByCalledNumber(calledNumber) : null;

    if (!tenant) {
      console.error(`[worker] No tenant found for called number: "${calledNumber}"`);
      return;
    }

    const [client] = await Promise.all([
      resolveClientByPhone(tenant.id, callerPhone),
      upsertClient(tenant.id, callerPhone),
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
