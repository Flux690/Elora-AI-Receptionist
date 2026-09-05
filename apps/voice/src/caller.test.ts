import { describe, it, expect } from "vitest";
import { resolveCallerPhone } from "./caller.js";

/**
 * PLAN.md 1.8.1 — the highest-severity defect in the codebase.
 *
 * `worker.ts` fell back to the literal string "unknown" when `sip.phoneNumber`
 * was absent. That string then became:
 *
 *   - the upsert key for `clients`, which is UNIQUE on (tenant_id, phone_number)
 *   - the lookup key in `getUpcomingByPhone`
 *
 * So every caller withholding their number, for a given business, collapsed into
 * a single client row — and `lookupAppointments` would read one caller's
 * appointments aloud to a different caller. Withheld caller ID is common enough
 * that this was going to happen.
 *
 * Absent caller ID means *no identity*, not an identity named "unknown".
 */
describe("resolveCallerPhone", () => {
  it("returns the caller's number when present", () => {
    expect(resolveCallerPhone({ "sip.phoneNumber": "+14155550123" }, false)).toBe(
      "+14155550123"
    );
  });

  it("returns null — not 'unknown' — when caller ID is withheld", () => {
    expect(resolveCallerPhone({}, false)).toBeNull();
  });

  it("returns null when caller ID is present but blank", () => {
    expect(resolveCallerPhone({ "sip.phoneNumber": "" }, false)).toBeNull();
    expect(resolveCallerPhone({ "sip.phoneNumber": "   " }, false)).toBeNull();
  });

  it("never conflates two withheld callers into one identity", () => {
    // The bug in one line: both of these were "unknown", and "unknown" is a
    // unique key.
    const a = resolveCallerPhone({}, false);
    const b = resolveCallerPhone({}, false);
    expect(a).toBeNull();
    expect(b).toBeNull();
    // null is not a usable identity, so nothing downstream can key on it.
    expect(a === "unknown" || b === "unknown").toBe(false);
  });

  it("returns null for browser test sessions — there is no real caller", () => {
    expect(resolveCallerPhone({ "sip.phoneNumber": "+14155550123" }, true)).toBeNull();
  });
});
