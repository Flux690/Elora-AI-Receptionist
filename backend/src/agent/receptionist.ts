import { voice } from "@livekit/agents";
import type { AgentDeps } from "./types.js";
import { buildSystemPrompt } from "./prompt.js";
import { createAgentTools } from "./tools.js";

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
}
