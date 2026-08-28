import { llm, voice } from "@livekit/agents";
import type { AgentDeps } from "./types.js";
import { buildSystemPrompt } from "./prompt.js";
import { createAgentTools } from "./tools.js";
import { suppressSpeechOnToolTurns } from "./speech-guard.js";

/**
 * The agent itself — prompt and tools, both derived from `deps`.
 *
 * Deliberately in its own module with no side effects. `worker.ts` calls
 * `cli.runApp()` at the top level, so anything importing the class from there
 * would boot a real LiveKit worker. Tests need the bare class: LiveKit's
 * `voice.testing.withMockTools` keys on the Agent *constructor*, so it has to
 * be importable on its own.
 */
export class ReceptionistAgent extends voice.Agent {
  constructor(deps: AgentDeps) {
    super({
      instructions: buildSystemPrompt(deps),
      tools: createAgentTools(deps),
    });
  }

  /**
   * Every word the caller hears passes through here, so this is where the
   * "a turn either calls a tool or talks" rule is enforced.
   *
   * See `speech-guard.ts` for why it is a rule about the shape of the turn
   * rather than a filter over the words.
   */
  override async llmNode(
    chatCtx: llm.ChatContext,
    toolCtx: llm.ToolContext,
    modelSettings: voice.ModelSettings
  ) {
    const source = await voice.Agent.default.llmNode(this, chatCtx, toolCtx, modelSettings);
    if (!source) return null;
    // The transform preserves the element type exactly; the cast is only here
    // because `ReadableStream`'s generic is invariant in TypeScript and the
    // SDK's element union includes a `unique symbol` that cannot be restated.
    return suppressSpeechOnToolTurns(source as ReadableStream<unknown>) as typeof source;
  }
}
