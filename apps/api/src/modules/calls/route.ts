import { Hono } from "hono";
import type { AppEnv } from "../../types.js";
import { listCalls, getCallById } from "@receptionist/core/repositories/calls.js";
import { getPresignedRecordingUrl } from "@receptionist/core/providers/storage.js";

export const calls = new Hono<AppEnv>()
  .get("/", async (c) => {
    const limit = Number(c.req.query("limit") ?? 50);
    const offset = Number(c.req.query("offset") ?? 0);
    return c.json(await listCalls(c.get("tenantId"), limit, offset));
  })
  .get("/:id", async (c) => {
    const call = await getCallById(c.req.param("id"), c.get("tenantId"));
    if (!call) return c.json({ error: "Call not found" }, 404);
    return c.json(call);
  })
  .get("/:id/recording", async (c) => {
    const callId = c.req.param("id");
    const call = await getCallById(callId, c.get("tenantId"));
    if (!call) return c.json({ error: "Call not found" }, 404);
    if (!call.recordingUrl) return c.json({ error: "No recording for this call" }, 404);
    return c.json({ url: await getPresignedRecordingUrl(callId) });
  });
