import { describe, it, expect, beforeAll } from "vitest";
import { createEscalation, getEscalationById } from "../src/repositories/escalations.js";
import { db } from "../src/db/client.js";
import { escalations } from "../src/db/schema.js";
import { eq, sql } from "drizzle-orm";

const RACE_WIDTH = 8;

/**
 * Force the pool to open RACE_WIDTH connections before any race test runs.
 *
 * Without this the bug hides: on a cold pool, TCP/TLS establishment completes at
 * different times, which staggers the SELECTs enough that the first INSERT lands
 * before the others look. Measured — cold pool: 8 fulfilled, 0 rejected; warm
 * pool: 1 fulfilled, 7 rejected.
 *
 * A warm pool is now the normal case in production: db/client.ts sets
 * keepAlive with a 30s idle timeout precisely so sockets stay open (PLAN.md
 * 1.6.4). That change makes this race MORE likely, not less.
 */
beforeAll(async () => {
  await Promise.all(
    Array.from({ length: RACE_WIDTH }, () => db.execute(sql`SELECT pg_sleep(0.15)`))
  );
});
import { makeAgent, makeCall } from "./factories.js";

/**
 * PLAN.md 1.7.4 — escalation deduplication throws instead of returning.
 *
 * `createEscalation` does a SELECT then an INSERT. That handles the *sequential*
 * case, but two tool calls inside one turn race: both SELECTs miss, both INSERT,
 * and the partial unique index on (call_id, lower(question)) makes the second
 * one throw — out of the tool, mid-call.
 *
 * The test has to be concurrent to be red. A sequential version passes today.
 */
describe("createEscalation", () => {
  it("returns the existing row instead of throwing when two land at once", async () => {
    const agent = await makeAgent();
    const call = await makeCall(agent.id);

    const input = {
      agentId: agent.id,
      callId: call.id,
      callerPhone: "+14155550123",
      question: "Do you offer gift cards?",
    };

    // All start before any finishes — the real in-turn race, against the
    // pre-warmed pool established in beforeAll.
    const results = await Promise.all(
      Array.from({ length: RACE_WIDTH }, () => createEscalation({ ...input }))
    );

    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);

    const rows = await db
      .select()
      .from(escalations)
      .where(eq(escalations.callId, call.id));
    expect(rows).toHaveLength(1);
  });

  it("dedupes case-insensitively, matching the index definition", async () => {
    const agent = await makeAgent();
    const call = await makeCall(agent.id);
    const base = { agentId: agent.id, callId: call.id, callerPhone: "+14155550123" };

    const a = await createEscalation({ ...base, question: "Do you take card?" });
    const b = await createEscalation({ ...base, question: "DO YOU TAKE CARD?" });

    expect(b.id).toBe(a.id);
  });

  it("keeps the same question separate across different calls", async () => {
    const agent = await makeAgent();
    const [callOne, callTwo] = await Promise.all([
      makeCall(agent.id),
      makeCall(agent.id),
    ]);
    const q = "Do you validate parking?";

    const a = await createEscalation({
      agentId: agent.id,
      callId: callOne.id,
      callerPhone: "+14155550001",
      question: q,
    });
    const b = await createEscalation({
      agentId: agent.id,
      callId: callTwo.id,
      callerPhone: "+14155550002",
      question: q,
    });

    expect(b.id).not.toBe(a.id);
  });

  it("records an escalation from a caller with no number", async () => {
    const agent = await makeAgent();
    const call = await makeCall(agent.id, { callerPhone: null });

    const row = await createEscalation({
      agentId: agent.id,
      callId: call.id,
      callerPhone: null,
      question: "Are you open on Sunday?",
    });

    const stored = await getEscalationById(row.id, agent.id);
    expect(stored).not.toBeNull();
  });
});

describe("escalation before the call row exists (PLAN.md 1.7.3)", () => {
  /**
   * DB writes are deferred until after the greeting so the caller hears audio
   * with no blocking round trip. That leaves a window where the agent is live
   * but `calls` has no row — and escalations.call_id is a foreign key to it.
   *
   * Reasoning that tools only fire after the caller speaks, so the window is
   * unreachable, is wrong on two counts: preemptive generation exists
   * specifically to start work before the turn is confirmed, and
   * allowInterruptions:false on the greeting blocks interruption of *speech*,
   * not speech-to-text.
   */
  it("rejects an escalation naming a call row that does not exist", async () => {
    const agent = await makeAgent();
    const ghostCallId = "00000000-0000-4000-8000-000000000000";

    // This is the mid-call throw the guard prevents.
    await expect(
      createEscalation({
        agentId: agent.id,
        callId: ghostCallId,
        callerPhone: "+14155550123",
        question: "Are you open Sunday?",
      })
    ).rejects.toThrow();
  });

  it("records the escalation unlinked when the call row is unavailable", async () => {
    const agent = await makeAgent();

    // What the tool does when callRowReady resolves false: keep the question,
    // drop the link, rather than losing the escalation entirely.
    const row = await createEscalation({
      agentId: agent.id,
      callId: null,
      callerPhone: "+14155550123",
      question: "Are you open Sunday?",
    });

    expect(row.callId).toBeNull();
    expect(row.question).toBe("Are you open Sunday?");
    expect(row.status).toBe("pending");
  });
});
