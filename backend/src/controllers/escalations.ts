import type { AppContext } from "../types.js";
import { listEscalations, getEscalationById } from "../services/escalations.js";
import { resolveEscalationWithKnowledge } from "../services/knowledge.js";
import { escalationResolveSchema } from "../schemas.js";

export async function list(c: AppContext) {
  const tenantId = c.get("tenantId");
  const status = c.req.query("status") === "resolved" ? "resolved" : "pending";
  return c.json(await listEscalations(tenantId, status));
}

export async function resolve(c: AppContext) {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id") ?? "";
  const parsed = escalationResolveSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const escalation = await getEscalationById(id, tenantId);
  if (!escalation) {
    return c.json({ error: "Escalation not found" }, 404);
  }

  // One transaction: a knowledge row without a resolved escalation (or the
  // reverse) is the broken state this replaces.
  await resolveEscalationWithKnowledge(escalation, tenantId, parsed.data.answer);

  return c.json({ id, status: "resolved" });
}
