import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  ConnectionState,
  BarVisualizer,
  ControlBar,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { joinLiveKitRoom } from "../services/livekitClient";
import "../CallInterface.css";

function AIStatus() {
  const { state, audioTrack } = useVoiceAssistant();

  const states = {
    listening: { text: "Listening", color: "#8B5CF6" },
    thinking: { text: "Processing", color: "#F59E0B" },
    speaking: { text: "Responding", color: "#10B981" },
  };
  const { text, color } = states[state] || {
    text: "Initializing",
    color: "#9CA3AF",
  };

  return (
    <div className="ai-status">
      <div className="status-indicator" style={{ backgroundColor: color }} />
      <div className="status-content">
        <div className="status-label">Elora</div>
        <div className="status-text">{text}</div>
      </div>
      <BarVisualizer state={state} trackRef={audioTrack} />
    </div>
  );
}

function SalonAssistantRoom({ token, onDisconnect }) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      connect
      audio={false}
      video={false}
      data-lk-theme="default"
      onDisconnected={onDisconnect}
      className="salon-room"
      options={{
        publishDefaults: { audioPreset: { maxBitrate: 20_000 } },
      }}
    >
      <RoomAudioRenderer />

      <div className="room-container">
        <header className="room-header">
          <ConnectionState className="connection-status">
            {({ state }) => (
              <span>
                {state.charAt(0).toUpperCase() + state.slice(1).toLowerCase()}
              </span>
            )}
          </ConnectionState>
        </header>

        <main className="room-main">
          <h1 className="assistant-title">Elora Assistant</h1>
          <p className="assistant-subtitle">AI Salon Receptionist</p>
          <AIStatus />
        </main>

        <footer className="room-footer">
          <ControlBar
            controls={{
              microphone: true,
              camera: false,
              screenShare: false,
              leave: true,
            }}
            variation="minimal"
            className="control-bar"
          />
        </footer>
      </div>
    </LiveKitRoom>
  );
}

function JoinScreen({ onJoin, joining, error }) {
  const [username, setUsername] = useState("Prabhat");
  const [callerId, setCallerId] = useState("9876543210");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && callerId) onJoin(username.trim(), callerId.trim());
  };

  return (
    <section className="join-screen">
      <div className="join-container">
        <h1 className="join-title">Elora Salon</h1>
        <p className="join-description">
          Connect with Elora, our AI assistant, to inquire about services,
          pricing, and availability.
        </p>
        <form onSubmit={handleSubmit} className="join-form">
          <label className="form-group">
            <span>Name</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              disabled={joining}
              required
            />
          </label>
          <label className="form-group">
            <span>Phone Number</span>
            <input
              type="tel"
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
              placeholder="Enter your phone number"
              disabled={joining}
              required
            />
          </label>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={joining} className="join-button">
            {joining ? "Connecting..." : "Start Conversation"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default function CallInterface() {
  const [token, setToken] = useState(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  const handleJoin = async (username, callerId) => {
    try {
      setJoining(true);
      setError(null);
      const { token } = await joinLiveKitRoom(username, callerId);
      setToken(token);
    } catch (err) {
      console.error("Error joining room:", err);
      setError("Failed to connect. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return token ? (
    <SalonAssistantRoom token={token} onDisconnect={() => setToken(null)} />
  ) : (
    <JoinScreen onJoin={handleJoin} joining={joining} error={error} />
  );
}
