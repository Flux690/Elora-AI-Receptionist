import type { AppContext } from "../types.js";
import { listAppointments } from "../services/appointments.js";

export async function list(c: AppContext) {
  const tenantId = c.get("tenantId");
  return c.json(await listAppointments(tenantId));
}
