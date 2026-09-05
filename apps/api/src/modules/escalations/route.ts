import { Hono } from "hono";
import type { AppEnv } from "../../types.js";
import { listEscalations, getEscalationById } from "@receptionist/core/repositories/escalations.js";
import { resolveEscalationWithKnowledge } from "@receptionist/core/repositories/knowledge.js";
import { escalationResolveSchema } from "../../schemas.js";

export const escalations = new Hono<AppEnv>()
  .get("/", async (c) => {
    const status = c.req.query("status") === "resolved" ? "resolved" : "pending";
    return c.json(await listEscalations(c.get("tenantId"), status));
  })
  .post("/:id/resolve", async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const parsed = escalationResolveSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const escalation = await getEscalationById(id, tenantId);
    if (!escalation) return c.json({ error: "Escalation not found" }, 404);

    await resolveEscalationWithKnowledge(escalation, tenantId, parsed.data.answer);
    return c.json({ id, status: "resolved" });
  });
