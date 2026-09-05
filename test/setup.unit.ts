import { initializeLogger } from "@livekit/agents";

/**
 * The Agents SDK reads a module-level logger when constructing STT, TTS and LLM,
 * and throws without one. `warn` keeps its info logging out of the assertions.
 */
initializeLogger({ pretty: false, level: "warn" });
