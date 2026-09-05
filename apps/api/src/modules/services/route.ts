import { Hono } from "hono";
import type { AppEnv } from "../../types.js";
import {
  listServices,
  createService,
  updateService,
  deleteService,
} from "@receptionist/core/repositories/services.js";
import { serviceDraftSchema, serviceUpdateSchema } from "../../schemas.js";

export const services = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listServices(c.get("tenantId"))))
  .post("/", async (c) => {
    const parsed = serviceDraftSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json(await createService(c.get("tenantId"), parsed.data), 201);
  })
  .patch("/:id", async (c) => {
    const parsed = serviceUpdateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const updated = await updateService(c.get("tenantId"), c.req.param("id"), parsed.data);
    if (!updated) return c.json({ error: "Service not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const deleted = await deleteService(c.get("tenantId"), id);
    if (!deleted) return c.json({ error: "Service not found" }, 404);
    return c.json({ id, deleted: true });
  });
