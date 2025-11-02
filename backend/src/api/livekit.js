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
  } catch (err) {
    console.error("Error generating token:", err);
    res.status(500).json({ error: "Token generation failed" });
  }
});

export default router;
