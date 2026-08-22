import type { AppContext } from "../types.js";
import {
  listServices,
  createService,
  updateService,
  deleteService,
} from "../services/services.js";
import { serviceDraftSchema, serviceUpdateSchema } from "../schemas.js";

export async function list(c: AppContext) {
  const tenantId = c.get("tenantId");
  return c.json(await listServices(tenantId));
}

export async function create(c: AppContext) {
  const tenantId = c.get("tenantId");
  const parsed = serviceDraftSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  return c.json(await createService(tenantId, parsed.data), 201);
}

export async function update(c: AppContext) {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id") ?? "";
  const parsed = serviceUpdateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const updated = await updateService(tenantId, id, parsed.data);
  if (!updated) return c.json({ error: "Service not found" }, 404);
  return c.json(updated);
}

export async function remove(c: AppContext) {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id") ?? "";

  const deleted = await deleteService(tenantId, id);
  if (!deleted) return c.json({ error: "Service not found" }, 404);
  return c.json({ id, deleted: true });
}
