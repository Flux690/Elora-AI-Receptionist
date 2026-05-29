import { AccessToken } from "livekit-server-sdk";
import { RoomConfiguration, RoomAgentDispatch } from "@livekit/protocol";
import type { AppContext } from "../types.js";
import { env } from "../env.js";

/**
 * POST /admin/agent/test
 *
 * Creates a LiveKit room with the "receptionist" agent explicitly dispatched,
 * and returns a participant token the browser can use to join and talk to the agent.
 *
 * The token carries `tenantId` and `testSession: "true"` in participant attributes,
 * so the worker resolves the tenant exactly as it would for a real SIP call but
 * skips recording and DB writes.
 */
export async function createTestSession(c: AppContext) {
  const tenantId = c.get("tenantId");
  const roomName = `test-${tenantId}-${Date.now()}`;

  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: `admin-${tenantId}`,
    name: "Admin (Test)",
    attributes: {
      tenantId,
      testSession: "true",
    },
    ttl: "10m",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  // Auto-dispatch the "receptionist" agent when this participant creates the room
  at.roomConfig = new RoomConfiguration({
    agents: [
      new RoomAgentDispatch({
        agentName: "receptionist",
      }),
    ],
  });

  const token = await at.toJwt();

  return c.json({
    serverUrl: env.LIVEKIT_URL,
    token,
    roomName,
  });
}
