import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAgentTools } from "./tools.js";
import { makeAgentDeps } from "../tests/fixtures.js";
import { createEscalation } from "@receptionist/core/repositories/escalations.js";
import { setCallerName } from "@receptionist/core/repositories/callers.js";

/**
 * Every tool's `execute` must actually RETURN something to the model.
 *
 * A body wrapped in `return await (async () => { ... })` is valid TypeScript
 * that never invokes the arrow: `await` on a function object yields the
 * function, so the tool resolves to a closure rather than a result. LiveKit
 * reports the call as finished with `isError: false` and no `output` field, the
 * model retries, gives up and escalates, and the caller is told someone will
 * follow up. Booking is dead and nothing says so.
 *
 * Typecheck cannot see it and neither can any test that does not call
 * `execute`. A tool that cannot be shown to return a value is a tool nobody has
 * tested, which is what these cases are for.
 */

const okCalendar = () =>
  makeAgentDeps({
    calendarExternalId: "cal-1",
    getGoogleToken: async () => "token-1",
  });

beforeEach(() => {
  vi.restoreAllMocks();
  // `restoreAllMocks` only undoes spies. The module mocks below are plain
  // `vi.fn()`s, so their call history survives into the next test unless it is
  // cleared — which quietly makes `mock.calls[0]` the *first* test's call.
  vi.clearAllMocks();
});

vi.mock("@receptionist/core/providers/calendar.js", () => ({
  fetchBusyRanges: vi.fn(async () => []),
  createCalendarEvent: vi.fn(async () => "evt-1"),
  deleteCalendarEvent: vi.fn(async () => {}),
}));

vi.mock("@receptionist/core/repositories/appointments.js", () => ({
  createAppointment: vi.fn(async () => ({ id: "appt-1" })),
  getUpcomingByPhone: vi.fn(async () => []),
  cancelAppointmentById: vi.fn(async () => null),
}));

vi.mock("@receptionist/core/repositories/escalations.js", () => ({
  createEscalation: vi.fn(async () => ({ id: "esc-1" })),
}));

vi.mock("@receptionist/core/repositories/callers.js", () => ({
  setCallerName: vi.fn(async () => null),
}));

/** The RunContext the SDK passes; only `session` is touched by these tools. */
const runCtx = () => ({ ctx: { session: { say: vi.fn(), shutdown: vi.fn() } } }) as never;

/** Escalation also reaches for `speechHandle`, to stop being interrupted. */
const escalationCtx = () =>
  ({ ctx: { speechHandle: {}, session: { say: vi.fn() } } }) as never;

describe("every tool returns a result to the model", () => {
  it("checkAvailability returns slots, not a function", async () => {
    const tools = createAgentTools(okCalendar());
    const result = await tools.checkAvailability.execute(
      { service: "Haircut", preferredDate: null, partOfDay: null },
      runCtx()
    );

    expect(typeof result, "a tool must never resolve to a function").not.toBe("function");
    expect(result).toBeDefined();
    // Either real slots or an explicit note — never undefined, never a closure.
    expect(result).toEqual(
      expect.objectContaining({ ...(("slots" in result!) ? {} : { note: expect.anything() }) })
    );
    expect("slots" in result! || "note" in result! || "error" in result!).toBe(true);
  });

  it("bookAppointment returns a result for an unknown slot", async () => {
    const tools = createAgentTools(okCalendar());
    const result = await tools.bookAppointment.execute(
      { slotId: "nope", callerName: "Prabhat" },
      runCtx()
    );

    expect(typeof result).not.toBe("function");
    expect(result).toHaveProperty("error");
  });

  it("bookAppointment returns a result for a held slot", async () => {
    const deps = okCalendar();
    const tools = createAgentTools(deps);

    // Offer a slot first, exactly as a real call does.
    const offered = (await tools.checkAvailability.execute(
      { service: "Haircut", preferredDate: null, partOfDay: null },
      runCtx()
    )) as { slots?: { slotId: string }[] };

    const slotId = offered.slots?.[0]?.slotId;
    expect(slotId, "checkAvailability produced no bookable slot").toBeDefined();

    const result = await tools.bookAppointment.execute(
      { slotId: slotId!, callerName: "Prabhat" },
      runCtx()
    );

    expect(typeof result).not.toBe("function");
    expect(result).toEqual(expect.objectContaining({ booked: true }));
  });

  it("lookupAppointments returns a result", async () => {
    const tools = createAgentTools(makeAgentDeps({ callerPhone: "+14155550123" }));
    const result = await tools.lookupAppointments.execute({}, runCtx());

    expect(typeof result).not.toBe("function");
    expect(result).toHaveProperty("appointments");
  });

  it("cancelAppointment returns a result", async () => {
    const tools = createAgentTools(okCalendar());
    const result = await tools.cancelAppointment.execute(
      { appointmentId: "appt-1" },
      runCtx()
    );

    expect(typeof result).not.toBe("function");
    expect(result).toHaveProperty("error");
  });

  it("createEscalation returns a result", async () => {
    const tools = createAgentTools(makeAgentDeps());
    const result = await tools.createEscalation.execute(
      { question: "Do you have parking?", callerName: null, transcriptExcerpt: null },
      escalationCtx()
    );

    expect(typeof result).not.toBe("function");
    expect(result).toEqual({ escalated: true });
  });
});

/**
 * An escalation is a promise to ring somebody back, so it has to record who.
 *
 * Asking is enforced by the schema rather than requested in prose, the same way
 * booking does it — the model cannot escalate without confronting the field.
 */
describe("the caller's name", () => {
  it("is recorded on the escalation when the caller gives one", async () => {
    const tools = createAgentTools(makeAgentDeps());
    await tools.createEscalation.execute(
      { question: "Do you take cats?", callerName: "Dana", transcriptExcerpt: null },
      escalationCtx()
    );

    expect(vi.mocked(createEscalation).mock.calls[0]?.[0]).toMatchObject({
      callerName: "Dana",
    });
  });

  it("is null when they were asked and declined", async () => {
    const tools = createAgentTools(makeAgentDeps());
    await tools.createEscalation.execute(
      { question: "Do you take cats?", callerName: null, transcriptExcerpt: null },
      escalationCtx()
    );

    expect(vi.mocked(createEscalation).mock.calls[0]?.[0]).toMatchObject({
      callerName: null,
    });
  });

  it("falls back to the name already on the client row", async () => {
    // A returning caller who does not say their name again is still known.
    const tools = createAgentTools(
      makeAgentDeps({ caller: { id: "cli-1", name: "Marcus" } as never })
    );
    await tools.createEscalation.execute(
      { question: "Do you take cats?", callerName: null, transcriptExcerpt: null },
      escalationCtx()
    );

    expect(vi.mocked(createEscalation).mock.calls[0]?.[0]).toMatchObject({
      callerName: "Marcus",
    });
  });

  it("is remembered for the next call, through the same helper booking uses", async () => {
    // The point of extracting `resolveCallerName`: escalation persists the name
    // exactly as booking does, rather than carrying a second copy that drifts.
    vi.mocked(setCallerName).mockResolvedValueOnce({
      id: "cli-1",
      name: "Dana",
    } as never);

    const tools = createAgentTools(
      makeAgentDeps({ caller: { id: "cli-1", name: null } as never })
    );
    await tools.createEscalation.execute(
      { question: "Do you take cats?", callerName: "  Dana  ", transcriptExcerpt: null },
      escalationCtx()
    );

    expect(vi.mocked(setCallerName)).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "cli-1",
      "Dana",
    );
  });
});
