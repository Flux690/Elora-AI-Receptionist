import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSystemPrompt } from "./prompt.js";
import { DEFAULT_BUSINESS_HOURS } from "@receptionist/shared";
import { makeAgentDeps, makeWorkerTenant } from "../test/agent-fixtures.js";

/**
 * PLAN.md 1.5 + 1.7.1 — the system prompt.
 *
 * Time is frozen and the tenant pinned to America/New_York so every date
 * assertion is stable. The chosen instant is deliberately awkward: 2026-08-19
 * 02:30 UTC is still *Tuesday the 18th* in New York, so any implementation that
 * formats in UTC instead of the business timezone fails these tests.
 */
const FROZEN_UTC = new Date("2026-08-19T02:30:00Z");

describe("buildSystemPrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_UTC);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("date and time grounding", () => {
    it("states today's date in the business timezone, not UTC", () => {
      const prompt = buildSystemPrompt(makeAgentDeps());

      // 02:30 UTC on the 19th is 22:30 on Tuesday the 18th in New York.
      expect(prompt).toContain("Tuesday");
      expect(prompt).toContain("2026-08-18");
      expect(prompt).not.toContain("2026-08-19T02:30");
    });

    it("names the IANA timezone so the model knows what zone it is reasoning in", () => {
      expect(buildSystemPrompt(makeAgentDeps())).toContain("America/New_York");
    });

    it("respects a different tenant timezone", () => {
      const tenant = makeWorkerTenant({ timezone: "Asia/Kolkata" });
      const prompt = buildSystemPrompt(makeAgentDeps({ tenant }));

      // 02:30 UTC on the 19th is 08:00 on Wednesday the 19th in Kolkata.
      expect(prompt).toContain("Asia/Kolkata");
      expect(prompt).toContain("2026-08-19");
      expect(prompt).toContain("Wednesday");
    });

    it("pre-computes the next seven days so the model never does date arithmetic", () => {
      const prompt = buildSystemPrompt(makeAgentDeps());

      // Today is Tue 2026-08-18 in New York, so the next seven days are the
      // 19th through the 25th, each paired with its weekday name.
      expect(prompt).toContain("2026-08-19");
      expect(prompt).toContain("2026-08-20");
      expect(prompt).toContain("2026-08-25");
      expect(prompt).toMatch(/Wednesday[^\n]*2026-08-19|2026-08-19[^\n]*Wednesday/);
      expect(prompt).toMatch(/Tuesday[^\n]*2026-08-25|2026-08-25[^\n]*Tuesday/);
    });
  });

  describe("knowledge base", () => {
    it("inlines knowledge so no tool call is needed to answer", () => {
      const prompt = buildSystemPrompt(
        makeAgentDeps({
          knowledge: [
            { question: "Do you have parking?", answer: "Yes, free lot behind the building." },
            { question: "Do you take walk-ins?", answer: "Walk-ins welcome before 3pm." },
          ],
        })
      );

      expect(prompt).toContain("Do you have parking?");
      expect(prompt).toContain("Yes, free lot behind the building.");
      expect(prompt).toContain("Walk-ins welcome before 3pm.");
    });

    it("omits the section entirely when there is no knowledge", () => {
      const prompt = buildSystemPrompt(makeAgentDeps({ knowledge: [] }));
      expect(prompt).not.toContain("## Knowledge");
    });
  });

  describe("prompt caching", () => {
    /**
     * Caching keys on an unchanging prefix. Everything stable (business,
     * services, knowledge, rules) has to come before anything per-call (caller
     * identity, current time), or the per-call block invalidates the cache for
     * everything after it — which is what a Caller block in the middle does.
     */
    it("puts all per-call content after all stable content", () => {
      const prompt = buildSystemPrompt(
        makeAgentDeps({
          knowledge: [{ question: "Parking?", answer: "Yes." }],
        })
      );

      const lastStable = Math.max(
        prompt.indexOf("## Services"),
        prompt.indexOf("## Knowledge"),
        prompt.indexOf("## Behavior")
      );
      const firstPerCall = Math.min(
        ...[prompt.indexOf("## Caller"), prompt.indexOf("## Current time")].filter(
          (i) => i >= 0
        )
      );

      expect(lastStable).toBeGreaterThanOrEqual(0);
      expect(firstPerCall).toBeGreaterThan(lastStable);
    });

    it("produces a byte-identical stable prefix across two different callers", () => {
      const knowledge = [{ question: "Parking?", answer: "Yes." }];
      const a = buildSystemPrompt(makeAgentDeps({ knowledge, callerPhone: "+14155550001" }));
      const b = buildSystemPrompt(makeAgentDeps({ knowledge, callerPhone: "+14155550002" }));

      const prefixOf = (p: string) => p.slice(0, p.indexOf("## Caller"));
      expect(prefixOf(a)).toBe(prefixOf(b));
      expect(prefixOf(a).length).toBeGreaterThan(0);
    });
  });

  describe("caller identity", () => {
    it("does not render a withheld number as the string 'null'", () => {
      const prompt = buildSystemPrompt(makeAgentDeps({ callerPhone: null }));
      expect(prompt).not.toContain("null");
      expect(prompt.toLowerCase()).toContain("withheld");
    });
  });

  describe("opening hours", () => {
    it("states the weekly pattern in words a caller would hear", () => {
      const prompt = buildSystemPrompt(makeAgentDeps());

      // 24-hour time is for storage, not for saying out loud.
      expect(prompt).toContain("Monday: 9:00 AM to 5:00 PM");
      expect(prompt).not.toContain("Monday: 09:00");
    });

    it("says Closed for a day with no opening periods", () => {
      // "Are you open Saturday?" was an escalation every time before hours
      // existed — the agent had nothing to answer from.
      expect(buildSystemPrompt(makeAgentDeps())).toContain("Sunday: Closed");
    });

    it("renders a lunch closure as two periods, not one long day", () => {
      const tenant = makeWorkerTenant({
        businessHours: {
          weekly: {
            ...DEFAULT_BUSINESS_HOURS.weekly,
            mon: [
              { start: "09:00", end: "13:00" },
              { start: "14:00", end: "18:00" },
            ],
          },
          exceptions: [],
        },
      });

      expect(buildSystemPrompt(makeAgentDeps({ tenant }))).toContain(
        "Monday: 9:00 AM to 1:00 PM, and 2:00 PM to 6:00 PM"
      );
    });

    it("surfaces an exception falling inside the next seven days", () => {
      // Frozen clock is Tuesday 18 Aug in New York; the 20th is inside the window.
      const tenant = makeWorkerTenant({
        businessHours: {
          ...DEFAULT_BUSINESS_HOURS,
          exceptions: [{ date: "2026-08-20", intervals: [], label: "Staff training" }],
        },
      });

      const prompt = buildSystemPrompt(makeAgentDeps({ tenant }));
      expect(prompt).toContain("2026-08-20 (Staff training): Closed");
    });

    it("omits an exception far outside the window — it is noise on every call", () => {
      const tenant = makeWorkerTenant({
        businessHours: {
          ...DEFAULT_BUSINESS_HOURS,
          exceptions: [{ date: "2026-12-25", intervals: [], label: "Christmas Day" }],
        },
      });

      expect(buildSystemPrompt(makeAgentDeps({ tenant }))).not.toContain("Christmas Day");
    });

    it("keeps hours in the cacheable prefix, above the per-call caller block", () => {
      const prompt = buildSystemPrompt(makeAgentDeps());
      expect(prompt.indexOf("## Hours")).toBeLessThan(prompt.indexOf("## Caller"));
    });
  });

  describe("services", () => {
    it("states each service's length so the agent can answer without a tool call", () => {
      const prompt = buildSystemPrompt(makeAgentDeps());
      expect(prompt).toContain("Haircut: $45 (30 minutes)");
      expect(prompt).toContain("Colour: $120 (120 minutes)");
    });
  });

  describe("logging", () => {
    it("does not log the prompt — it is customer business data, at call volume", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      buildSystemPrompt(makeAgentDeps());
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

describe("the prompt states facts; the tools state procedure", () => {
  /**
   * The system prompt is tool-agnostic on purpose. It says who the agent is,
   * what the business is, and how to behave. *How and when to use a tool* lives
   * on that tool's own description and its parameter descriptions, where the
   * model reads it at the moment it matters.
   *
   * Mixing the two is what puts "use rememberCallerName once, never ask for it
   * outright" in front of the model on every turn, so a caller is never asked
   * their name and every booking lands in the diary as "caller ID withheld".
   */
  const TOOL_NAMES = [
    "checkAvailability",
    "bookAppointment",
    "createEscalation",
    "rememberCallerName",
    "lookupAppointments",
    "cancelAppointment",
    "endCall",
  ];

  it("never names a tool", () => {
    const prompt = buildSystemPrompt(
      makeAgentDeps({
        calendarExternalId: "cal-1",
        knowledge: [{ question: "Do you have parking?", answer: "Yes, out front." }],
      })
    );

    const named = TOOL_NAMES.filter((tool) => prompt.includes(tool));
    expect(named, `the prompt names ${named.join(", ")} — that belongs on the tool`).toEqual([]);
  });

  it("still states whether booking is possible at all", () => {
    // A fact about the tenant, which the model needs before it reaches for
    // anything. Not an instruction about which tool to call.
    const connected = buildSystemPrompt(makeAgentDeps({ calendarExternalId: "cal-1" }));
    expect(connected.toLowerCase()).toContain("calendar is connected");

    const disconnected = buildSystemPrompt(makeAgentDeps({ calendarExternalId: null }));
    expect(disconnected.toLowerCase()).toContain("no calendar connected");
  });
});
