import { Hono } from "hono";
import type { AppEnv } from "../../types.js";
import { listKnowledge, deleteKnowledge } from "@receptionist/core/repositories/knowledge.js";

export const knowledge = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listKnowledge(c.get("tenantId"))))
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await deleteKnowledge(id, c.get("tenantId"));
    return c.json({ id, deleted: true });
  });
