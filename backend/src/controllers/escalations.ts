import type { AppContext } from "../types.js";
import {
  listEscalations,
  resolveEscalation,
  getEscalationById,
} from "../services/escalations.js";
import { createKnowledgeFromEscalation } from "../services/knowledge.js";

export async function list(c: AppContext) {
  const tenantId = c.get("tenantId");
  const status = c.req.query("status") === "resolved" ? "resolved" : "pending";
  return c.json(await listEscalations(tenantId, status));
}

export async function resolve(c: AppContext) {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id") ?? "";
  const { answer } = await c.req.json<{ answer?: string }>();

  if (!answer?.trim()) {
    return c.json({ error: "answer is required" }, 400);
  }

  const escalation = await getEscalationById(id, tenantId);
  if (!escalation) {
    return c.json({ error: "Escalation not found" }, 404);
  }

  await createKnowledgeFromEscalation(escalation, answer);
  await resolveEscalation(id, tenantId, answer);

  return c.json({ id, status: "resolved" });
}
