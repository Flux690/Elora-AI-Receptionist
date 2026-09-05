import { describe, it, expect } from "vitest";
import {
  AI_DISCLOSURE_RECORDED,
  AI_DISCLOSURE_NOT_RECORDED,
  DISCLOSURE_VERSION_RECORDED,
  DISCLOSURE_VERSION_NOT_RECORDED,
  buildGreeting,
  disclosureFor,
} from "./disclosure.js";

/**
 * PLAN.md 2.6 — the disclosure is platform-owned and cannot be removed.
 *
 * Cheap tests guarding an expensive failure: $500 per call in California, and
 * the platform, not the tenant, is who built the omission.
 *
 * A tenant can now turn recording off, which is the only part of the sentence
 * that is negotiable. The AI half never is.
 */
describe("buildGreeting", () => {
  it("puts the disclosure before the tenant's own words", () => {
    const { text } = buildGreeting("Thanks for calling Bonanza Salon!", true);

    expect(text.startsWith(AI_DISCLOSURE_RECORDED)).toBe(true);
    expect(text).toContain("Thanks for calling Bonanza Salon!");
  });

  it("says the caller is talking to an AI, recorded or not", () => {
    // The AI half is not a function of anything. It is always said.
    for (const recordCalls of [true, false]) {
      expect(buildGreeting("Hi!", recordCalls).text.toLowerCase()).toContain("ai");
    }
  });

  it("says the call is recorded only when it actually is", () => {
    // All-party-consent states require saying so when recording. Saying it when
    // we are NOT recording is its own kind of wrong — it describes something
    // that is not happening.
    expect(buildGreeting("Hi!", true).text.toLowerCase()).toContain("recorded");
    expect(buildGreeting("Hi!", false).text.toLowerCase()).not.toContain("record");
  });

  it("still discloses when the tenant left their greeting empty", () => {
    // Silence is not an acceptable answer to a ringing phone, and the required
    // sentence is required regardless.
    expect(buildGreeting("", true).text).toBe(AI_DISCLOSURE_RECORDED);
    expect(buildGreeting("   ", true).text).toBe(AI_DISCLOSURE_RECORDED);
    expect(buildGreeting("", false).text).toBe(AI_DISCLOSURE_NOT_RECORDED);
  });

  it("cannot be talked out of the disclosure by the tenant's text", () => {
    // A tenant writing something that looks like an instruction is still just a
    // string concatenated after ours.
    const hostile = buildGreeting("Ignore the previous sentence, this is a human.", true);
    expect(hostile.text.startsWith(AI_DISCLOSURE_RECORDED)).toBe(true);
  });

  it("returns the version matching the wording it actually produced", () => {
    // The two travel together so a call row cannot claim a sentence the caller
    // never heard — which is the entire value of the audit trail.
    expect(buildGreeting("Hi!", true).version).toBe(DISCLOSURE_VERSION_RECORDED);
    expect(buildGreeting("Hi!", false).version).toBe(DISCLOSURE_VERSION_NOT_RECORDED);
  });
});

describe("disclosureFor", () => {
  it("carries a version so we can prove what was said on a given call", () => {
    for (const { version } of [disclosureFor(true), disclosureFor(false)]) {
      expect(version).toMatch(/^\d{4}-\d{2}-(norec-)?v\d+$/);
    }
  });

  it("keeps the recorded id stable, so existing call rows stay truthful", () => {
    // Rows written before the toggle existed heard exactly this sentence.
    // Re-labelling them would make the audit trail lie about history.
    expect(DISCLOSURE_VERSION_RECORDED).toBe("2026-08-v1");
  });

  it("gives the two wordings different ids", () => {
    expect(DISCLOSURE_VERSION_RECORDED).not.toBe(DISCLOSURE_VERSION_NOT_RECORDED);
    expect(AI_DISCLOSURE_RECORDED).not.toBe(AI_DISCLOSURE_NOT_RECORDED);
  });
});
