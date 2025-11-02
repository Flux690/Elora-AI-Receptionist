import axios from "axios";
import { nanoid } from "nanoid";

const URL = "http://localhost:8080/api/livekit";

export async function joinLiveKitRoom(participantName, callerId) {
  const roomName = nanoid(8);
  const response = await axios.post(`${URL}/token`, {
    roomName,
    participantName,
    callerId,
  });

  return { token: response.data.token, roomName };
}
