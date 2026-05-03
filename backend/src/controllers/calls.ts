import type { AppContext } from "../types.js";
import { listCalls } from "../services/calls.js";

export async function list(c: AppContext) {
  const tenantId = c.get("tenantId");
  return c.json(await listCalls(tenantId));
}
