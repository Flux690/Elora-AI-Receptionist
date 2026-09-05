import { initializeLogger } from "@livekit/agents";

/**
 * The Agents SDK lazily reads a module-level logger when constructing STT/TTS/LLM
 * and throws "logger not initialized" if it was never set up. LiveKit's own
 * testing guide requires this call at the top of every test file; doing it once
 * here keeps it out of the tests themselves.
 *
 * `pretty: false` so output stays greppable, `warn` so the SDK's very chatty
 * info-level logging does not bury assertion failures.
 */
initializeLogger({ pretty: false, level: "warn" });
