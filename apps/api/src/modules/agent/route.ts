import { Hono } from "hono";
import { AccessToken } from "livekit-server-sdk";
import { RoomConfiguration, RoomAgentDispatch } from "@livekit/protocol";
import type { AppEnv } from "../../types.js";
import { env } from "@receptionist/core/env.js";

/**
 * The token carries `agentId` and `testSession`, so the worker resolves the
 * agent as it would for a SIP call while skipping recording and the call row.
 */
export const agent = new Hono<AppEnv>().post("/test", async (c) => {
  const agentId = c.get("agentId");
  const roomName = `test-${agentId}-${Date.now()}`;

  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: `admin-${agentId}`,
    name: "Admin (Test)",
    attributes: { agentId, testSession: "true" },
    ttl: "10m",
  });

  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: "receptionist" })],
  });

  return c.json({ serverUrl: env.LIVEKIT_URL, token: await at.toJwt(), roomName });
});
