import type { AppContext } from "../types.js";
import { listCalls, getCallById } from "../services/calls.js";

export async function list(c: AppContext) {
  const tenantId = c.get("tenantId");
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);
  return c.json(await listCalls(tenantId, limit, offset));
}

export async function getById(c: AppContext) {
  const tenantId = c.get("tenantId");
  const callId = c.req.param("id") ?? "";
  const call = await getCallById(callId, tenantId);
  if (!call) return c.json({ error: "Call not found" }, 404);
  return c.json(call);
}
