import type { AppContext } from "../types.js";
import { listKnowledge, deleteKnowledge } from "../services/knowledge.js";

export async function list(c: AppContext) {
  const tenantId = c.get("tenantId");
  return c.json(await listKnowledge(tenantId));
}

export async function remove(c: AppContext) {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id") ?? "";
  await deleteKnowledge(id, tenantId);
  return c.json({ id, deleted: true });
}
