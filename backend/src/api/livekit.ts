import express from "express";
import { AccessToken } from "livekit-server-sdk";
import config from "../config.js";

const router = express.Router();

router.post("/token", async (req, res) => {
  const { roomName, participantName, callerId } = req.body;
  if (!roomName || !participantName)
    return res
      .status(400)
      .json({ error: "Room Name and Participant Name are required" });

  try {
    if (!config.livekit.apiKey || !config.livekit.apiSecret) {
      throw new Error("LiveKit credentials are not configured");
    }

    const at = new AccessToken(
      config.livekit.apiKey,
      config.livekit.apiSecret,
      {
        identity: participantName,
        metadata: JSON.stringify({ callerId }),
        ttl: 600,
      }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    res.json({ token });
  } catch (err: unknown) {
    console.error("Error generating token:", err);
    const message = err instanceof Error ? err.message : "Token generation failed";
    res.status(500).json({ error: message });
  }
});

export default router;
