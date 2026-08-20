import { describe, it, expect } from "vitest";
import { ReceptionistAgent } from "./receptionist.js";
import { makeAgentDeps } from "../test/agent-fixtures.js";

/**
 * Agent-level assertions using the bare class — no LiveKit worker, no network.
 * This is why `ReceptionistAgent` lives in its own module: `worker.ts` calls
 * `cli.runApp()` at the top level, so importing it here would boot a worker.
 *
 * These are deterministic and free. Tests that need a real model to *choose*
 * a tool live in `*.live.test.ts`.
 */
describe("ReceptionistAgent", () => {
  // `toolCtx` is a ToolContext instance, not a plain object — Object.keys on it
  // returns private field names. `functionTools` is the public accessor.
  const toolNames = (deps = makeAgentDeps()) =>
    Object.keys(new ReceptionistAgent(deps).toolCtx.functionTools);

  it("no longer exposes searchKnowledge — the knowledge base is in the prompt", () => {
    // PLAN.md 1.5: a knowledge question used to cost two extra LLM round trips
    // plus an embedding call and a vector query. If this tool comes back, that
    // cost comes back with it.
    expect(toolNames()).not.toContain("searchKnowledge");
  });

  it("still exposes createEscalation — it is a deliberate write, not a lookup", () => {
    expect(toolNames()).toContain("createEscalation");
  });

  it("exposes the booking and call-control tools", () => {
    expect(toolNames()).toEqual(
      expect.arrayContaining([
        "createEscalation",
        "checkAvailability",
        "bookAppointment",
        "lookupAppointments",
        "cancelAppointment",
        "endCall",
        "rememberCallerName",
      ])
    );
  });

  it("greets a known returning caller by name", () => {
    // PLAN.md 1.8.4: clients.name existed but nothing ever wrote it, so this
    // branch was unreachable dead code. rememberCallerName now populates it.
    const deps = makeAgentDeps({
      client: { id: "c1", name: "Sarah" } as never,
    });

    expect(new ReceptionistAgent(deps).instructions).toContain("Sarah");
  });

  it("builds instructions containing the inlined knowledge base", () => {
    const agent = new ReceptionistAgent(
      makeAgentDeps({
        knowledge: [{ question: "Do you have parking?", answer: "Yes, free lot." }],
      })
    );

    expect(agent.instructions).toContain("Do you have parking?");
    expect(agent.instructions).toContain("Yes, free lot.");
  });
});
