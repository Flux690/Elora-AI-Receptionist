import { describe, it, expect } from "vitest";
import { db } from "../db/client.js";
import { knowledgeItems } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { makeTenant, makeEscalation } from "../test/factories.js";

import {
  createKnowledgeFromEscalation,
  deleteKnowledge,
  listKnowledgeForPrompt,
  resolveEscalationWithKnowledge,
} from "./knowledge.js";
import { getEscalationById } from "./escalations.js";

describe("deleteKnowledge", () => {
  /**
   * PLAN.md 1.8.5 — deleting a knowledge item must not orphan its source
   * escalation.
   *
   * An escalation left `resolved` means the agent can never answer that question
   * again *and* the dedup index can stop it being re-escalated, which makes the
   * question permanently unanswerable with nothing to show for it.
   */
  it("reopens the source escalation so the question can be answered again", async () => {
    const tenant = await makeTenant();
    const escalation = await makeEscalation(tenant.id, {
      question: "Do you validate parking?",
    });

    await resolveEscalationWithKnowledge(escalation, tenant.id, "Yes, up to two hours.");

    const [item] = await db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.sourceEscalationId, escalation.id));
    expect(item).toBeDefined();

    await deleteKnowledge(item!.id, tenant.id);

    const after = await getEscalationById(escalation.id, tenant.id);
    expect(after?.status).toBe("pending");
    expect(after?.answer).toBeNull();
    expect(after?.resolvedAt).toBeNull();
  });

  it("deletes knowledge that has no source escalation without error", async () => {
    const tenant = await makeTenant();
    const escalation = await makeEscalation(tenant.id);
    await createKnowledgeFromEscalation(escalation, "An answer.");

    const [item] = await db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.tenantId, tenant.id));

    // Detach it, mimicking an escalation deleted earlier (ON DELETE SET NULL).
    await db
      .update(knowledgeItems)
      .set({ sourceEscalationId: null })
      .where(eq(knowledgeItems.id, item!.id));

    await expect(deleteKnowledge(item!.id, tenant.id)).resolves.not.toThrow();
  });

  it("will not delete another tenant's knowledge", async () => {
    const [owner, attacker] = await Promise.all([makeTenant(), makeTenant()]);
    const escalation = await makeEscalation(owner.id);
    await createKnowledgeFromEscalation(escalation, "Owner's answer.");

    const [item] = await db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.tenantId, owner.id));

    await deleteKnowledge(item!.id, attacker.id);

    const still = await db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.id, item!.id));
    expect(still).toHaveLength(1);
  });
});

describe("listKnowledgeForPrompt", () => {
  it("returns question and answer for the tenant, oldest first", async () => {
    const tenant = await makeTenant();
    const first = await makeEscalation(tenant.id, { question: "First?" });
    await createKnowledgeFromEscalation(first, "First answer.");
    const second = await makeEscalation(tenant.id, { question: "Second?" });
    await createKnowledgeFromEscalation(second, "Second answer.");

    const entries = await listKnowledgeForPrompt(tenant.id);

    expect(entries.map((e) => e.question)).toEqual(["First?", "Second?"]);
    expect(entries[0]).toEqual({ question: "First?", answer: "First answer." });
  });

  it("is scoped to the tenant", async () => {
    const [a, b] = await Promise.all([makeTenant(), makeTenant()]);
    const esc = await makeEscalation(a.id);
    await createKnowledgeFromEscalation(esc, "A's answer.");

    expect(await listKnowledgeForPrompt(b.id)).toEqual([]);
  });
});

describe("resolveEscalationWithKnowledge", () => {
  it("files the answer and resolves the escalation together", async () => {
    const tenant = await makeTenant();
    const escalation = await makeEscalation(tenant.id, { question: "Gift cards?" });

    await resolveEscalationWithKnowledge(escalation, tenant.id, "Yes, any amount.");

    const after = await getEscalationById(escalation.id, tenant.id);
    expect(after?.status).toBe("resolved");
    expect(after?.answer).toBe("Yes, any amount.");
    expect(after?.resolvedAt).not.toBeNull();

    expect(await listKnowledgeForPrompt(tenant.id)).toEqual([
      { question: "Gift cards?", answer: "Yes, any amount." },
    ]);
  });

  it("writes no knowledge row when the escalation cannot be resolved", async () => {
    const tenant = await makeTenant();
    const other = await makeTenant();
    // Belongs to `tenant`, but resolved against `other` — the UPDATE matches no
    // row, so the transaction must roll the knowledge insert back with it.
    const escalation = await makeEscalation(tenant.id, { question: "Orphan?" });

    await expect(
      resolveEscalationWithKnowledge(escalation, other.id, "Should not persist.")
    ).rejects.toThrow();

    expect(await listKnowledgeForPrompt(tenant.id)).toEqual([]);
    const after = await getEscalationById(escalation.id, tenant.id);
    expect(after?.status).toBe("pending");
  });
});
