import {
  defineAgent,
  cli,
  voice,
  inference,
  WorkerOptions,
} from "@livekit/agents";
import * as silero from "@livekit/agents-plugin-silero";
import * as livekit from "@livekit/agents-plugin-livekit";
import { RoomServiceClient } from "livekit-server-sdk";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { initializeRetriever } from "./retriever.js";
import { isEndingConversation } from "./endings.js";
import config from "../config.js";
import db from "../database.js";

dotenv.config({ path: ".env" });

const roomService = new RoomServiceClient(
  config.livekit.url,
  config.livekit.apiKey,
  config.livekit.apiSecret
);

class RagAgent extends voice.Agent {
  constructor(callerId, retriever) {
    super({
      instructions: `You are a friendly salon receptionist.
- Answer customer questions based ONLY on the information provided to you.
- Be warm, professional, and helpful.
- If information is not provided, politely say you'll check with your supervisor.
- Keep responses concise and natural.`,
    });
    this.callerId = callerId;
    this.retriever = retriever;
    this.ended = false; // signal for ending conversation and room deletion
  }

  async onUserTurnCompleted(turnCtx, newMessage) {
    const userQuery = newMessage.textContent;
    console.log("[USER]:", userQuery);

    if (!this.retriever) {
      console.error("[AGENT] Retriever unavailable!");
      turnCtx.addMessage({
        role: "assistant",
        content: "Apologize - you're having technical difficulties.",
      });
      return;
    }

    // Check if user is ending the conversation
    if (isEndingConversation(userQuery)) {
      console.log(
        "[AGENT] User ending conversation - will disconnect after goodbye"
      );

      this.ended = true;

      turnCtx.addMessage({
        role: "system",
        content: "Say Exactly and nothing else- Thank you for calling!",
      });
      return;
    }

    // Perform RAG lookup
    const result = this.retriever.findBestMatch(userQuery);
    if (result.found) {
      turnCtx.addMessage({
        role: "assistant",
        content: `Say Exactly- ${result.answer}. Is there anything else you'd like to know?`,
      });
    } else {
      try {
        await db.createPendingRequest(userQuery, this.callerId);
        console.log("[AGENT] Pending request created");
      } catch (err) {
        console.error("[AGENT] DB error:", err);
      }
      turnCtx.addMessage({
        role: "assistant",
        content:
          "Say Exactly and nothing else- Let me check with my supervisor and get back to you. Is there anything else I can help you with?",
      });
    }
  }
}

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
    proc.userData.retriever = await initializeRetriever();
  },
  entry: async (ctx) => {
    await ctx.connect();
    console.log("[ROOM]:", ctx.room.name);
    const res = await roomService.listParticipants(ctx.room.name);
    console.log(res);
    const participant = await ctx.waitForParticipant();
    console.log("[PARTICIPANT]:", participant.identity);

    let callerId = "unknown";
    try {
      if (participant && participant.metadata) {
        const meta = JSON.parse(participant.metadata);
        if (meta && meta.callerId) callerId = meta.callerId;
      }
    } catch {}

    let retriever = ctx.proc?.userData?.retriever;
    if (!retriever) {
      console.log("[INIT] Waiting for retriever...");
      const maxWait = 10000;
      const start = Date.now();
      while (!retriever && Date.now() - start < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retriever = ctx.proc?.userData?.retriever;
      }
      if (!retriever) {
        throw new Error("Retriever failed to initialize");
      }
    }

    const session = new voice.AgentSession({
      stt: new inference.STT({
        model: "assemblyai/universal-streaming",
        language: "en",
      }),
      llm: new inference.LLM({
        model: "openai/gpt-4o-mini",
      }),
      tts: new inference.TTS({
        model: "cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        language: "en",
      }),
      vad: ctx.proc?.userData?.vad,
      turnDetection: new livekit.turnDetector.MultilingualModel(),
    });

    const agent = new RagAgent(callerId, retriever);

    // Listen for speech_created to handle post-goodbye cleanup
    const handleSpeechCreated = async (ev) => {
      if (agent.ended && ev.source === "generate_reply") {
        console.log(
          "[AGENT] Goodbye speech completed - closing session and deleting room"
        );
        try {
          await ev.speechHandle.waitForPlayout(); // Wait for playout to complete
          await session.close();
          await roomService.deleteRoom(ctx.room.name);
        } catch (err) {
          console.error("[AGENT] Error during cleanup:", err);
        } finally {
          agent.ended = false;
        }
        // Remove listener to avoid multiple triggers
        session.off("speech_created", handleSpeechCreated);
      }
    };
    session.on("speech_created", handleSpeechCreated);

    await session.start({
      agent,
      room: ctx.room,
    });

    const greeting = await session.say(
      "Hi, my name is Elora, your AI salon receptionist. How may I assist you today?"
    );
    await greeting.waitForPlayout();
    console.log("[READY] Agent listening");
  },
});

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
  })
);
