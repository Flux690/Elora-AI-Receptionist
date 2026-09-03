import type {
  BookingPolicy,
  BusinessHours,
  Service,
  TimeInterval,
  Weekday,
} from "@receptionist/shared";

/**
 * Slot generation, as pure functions.
 *
 * This module exists because the old `checkAvailability` walked fixed 60-minute
 * steps from an arbitrary start and returned anything Google's freeBusy did not
 * mark busy. It had no idea when the business was open, how long a service took,
 * or how much notice was needed — so a caller asking about tomorrow could be
 * offered 3 a.m. for a two-hour appointment.
 *
 * Nothing here touches the database, the network, or the clock except through an
 * explicit `now`, so every rule below is testable without booting a worker.
 */

/** Slot starts land on this grid. Fifteen minutes reads naturally out loud. */
const GRID_MINUTES = 15;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const WEEKDAY_BY_INDEX: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type Slot = {
  /** When the caller's appointment starts. */
  start: Date;
  /** When it ends. Excludes padding. */
  end: Date;
  /** Padding included — what the calendar must actually hold. */
  blockStart: Date;
  blockEnd: Date;
  /** Local calendar date, "YYYY-MM-DD". */
  dateIso: string;
};

export type BusyRange = { start: Date; end: Date };

export type PartOfDay = "morning" | "afternoon" | "evening";

/**
 * Wall-clock parts of an instant, in a specific zone.
 *
 * Everything goes through `Intl` with an explicit `timeZone`. Formatting in the
 * server's zone is the whole bug class this avoids: the worker runs in UTC and
 * the business is in New York, where "tomorrow" is a different day.
 */
function zonedParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  ) as Record<string, string>;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Some ICU builds render midnight as hour 24 rather than 00.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** How far the zone is from UTC at a given instant, in milliseconds. */
function offsetMsAt(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - instant.getTime();
}

/**
 * "2026-08-19" + "09:00" in America/New_York -> the matching UTC instant.
 *
 * Two passes, because the offset depends on the instant we are still solving
 * for. The first pass guesses using the offset at the naive timestamp; if the
 * result lands on the other side of a daylight-saving change the offset differs,
 * and the second pass corrects it.
 *
 * On the spring-forward gap the named wall clock does not exist and on the
 * autumn fall-back it happens twice; this resolves both to a single sensible
 * instant. Neither matters here — opening times are never inside the gap.
 *
 * No dependency: Temporal is not stable in Node 22, and this is the whole of
 * what a date library would be doing for us.
 */
export function zonedWallClockToUtc(
  dateIso: string,
  hhmm: string,
  timeZone: string
): Date {
  const [year, month, day] = dateIso.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);

  const naive = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const firstPass = naive - offsetMsAt(new Date(naive), timeZone);
  const corrected = naive - offsetMsAt(new Date(firstPass), timeZone);

  return new Date(corrected);
}

/** The local calendar date of an instant, "YYYY-MM-DD". */
export function localDateIso(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Pure calendar arithmetic on a date string — no timezone involved. */
export function addDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day!) + days * DAY_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate()
  )}`;
}

export function weekdayOf(dateIso: string): Weekday {
  const [year, month, day] = dateIso.split("-").map(Number);
  return WEEKDAY_BY_INDEX[new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()]!;
}

/**
 * The opening periods for one date.
 *
 * An exception replaces the weekly pattern outright rather than merging with it
 * — that is what makes "closed on Christmas Day" expressible at all.
 */
export function intervalsForDate(
  hours: BusinessHours,
  dateIso: string
): TimeInterval[] {
  const exception = hours.exceptions.find((e) => e.date === dateIso);
  if (exception) return exception.intervals;
  return hours.weekly[weekdayOf(dateIso)] ?? [];
}

export function isOpenOn(hours: BusinessHours, dateIso: string): boolean {
  return intervalsForDate(hours, dateIso).length > 0;
}

const PART_OF_DAY_RANGES: Record<PartOfDay, [number, number]> = {
  morning: [0, 12],
  afternoon: [12, 17],
  evening: [17, 24],
};

export type GenerateSlotsInput = {
  hours: BusinessHours;
  policy: BookingPolicy;
  service: Pick<
    Service,
    "durationMinutes" | "bufferBeforeMinutes" | "bufferAfterMinutes"
  >;
  timeZone: string;
  now: Date;
  /** Local date to start searching from. Defaults to today. */
  fromDate?: string;
  /** How many days to walk. Clamped by the policy's maximum. */
  days?: number;
  partOfDay?: PartOfDay | null;
};

/**
 * Every slot the business could offer, before the calendar is consulted.
 *
 * The grid walks **appointment** starts, not block starts, so the times a caller
 * hears land on the quarter hour rather than wherever the padding happened to
 * push them — a service with 10 minutes of setup offers 9:00 and 9:15, not 9:10
 * and 9:25.
 *
 * Extra time is held only where it fits inside the opening period, and is
 * **dropped rather than moved** at the edges. Before-time protects the
 * appointment that came before this one; at the moment the business opens there
 * is nothing behind it to protect, so a 45-minute service with 15 minutes of
 * setup is offered 9:00 in a shop that opens at 9:00, with the calendar holding
 * from 9:00. It is not offered 9:00 with a hold from 8:45: nobody is there at
 * 8:45. Closing is the mirror — the appointment may end exactly at close, and
 * the clearing up afterwards is not held on a calendar the business has shut.
 *
 * Requiring the whole padded block to fit inside the opening period instead
 * costs a 9-to-5 shop both its 9:00 and its 4:50, which is why it does not.
 */
export function generateCandidateSlots({
  hours,
  policy,
  service,
  timeZone,
  now,
  fromDate,
  days,
  partOfDay,
}: GenerateSlotsInput): Slot[] {
  const durationMs = service.durationMinutes * MINUTE_MS;
  if (durationMs <= 0) return [];

  const today = localDateIso(now, timeZone);
  const start = fromDate && fromDate > today ? fromDate : today;

  // Never search past the booking window, however many days were asked for.
  const lastAllowed = addDays(today, policy.maxAdvanceDays);
  const window = days ?? policy.maxAdvanceDays;

  const earliest = new Date(now.getTime() + policy.minNoticeMinutes * MINUTE_MS);
  const slots: Slot[] = [];

  for (let offset = 0; offset <= window; offset++) {
    const dateIso = addDays(start, offset);
    if (dateIso > lastAllowed) break;

    for (const interval of intervalsForDate(hours, dateIso)) {
      const opens = zonedWallClockToUtc(dateIso, interval.start, timeZone);
      const closes = zonedWallClockToUtc(dateIso, interval.end, timeZone);

      for (
        let startMs = opens.getTime();
        startMs + durationMs <= closes.getTime();
        startMs += GRID_MINUTES * MINUTE_MS
      ) {
        const appointmentStart = new Date(startMs);
        const endMs = startMs + durationMs;

        // Too soon: not because the calendar is busy, but because a person needs
        // warning. See BookingPolicy.
        if (appointmentStart < earliest) continue;

        if (partOfDay) {
          const [from, to] = PART_OF_DAY_RANGES[partOfDay];
          const hour = zonedParts(appointmentStart, timeZone).hour;
          if (hour < from || hour >= to) continue;
        }

        // Clamped to the interval, which is what drops the padding at an edge
        // rather than spilling it outside the hours the business keeps.
        const blockStart = Math.max(
          opens.getTime(),
          startMs - service.bufferBeforeMinutes * MINUTE_MS
        );
        const blockEnd = Math.min(
          closes.getTime(),
          endMs + service.bufferAfterMinutes * MINUTE_MS
        );

        slots.push({
          start: appointmentStart,
          end: new Date(endMs),
          blockStart: new Date(blockStart),
          blockEnd: new Date(blockEnd),
          dateIso,
        });
      }
    }
  }

  return slots;
}

/**
 * Drops slots whose padded block collides with something already on the calendar.
 *
 * The *block* is compared, not the appointment: cleanup after the previous job
 * is as real a conflict as the job itself.
 */
export function filterByBusy(slots: Slot[], busy: BusyRange[]): Slot[] {
  if (busy.length === 0) return slots;

  return slots.filter((slot) =>
    busy.every(
      (b) => slot.blockStart.getTime() >= b.end.getTime() || slot.blockEnd.getTime() <= b.start.getTime()
    )
  );
}

/** "Wed Aug 19, 2:00 PM" — how the agent says it out loud. */
export function describeSlot(slot: Slot, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(slot.start)
    // Drops the comma after the weekday only. The one before the time stays —
    // it is where a person pauses when reading the slot aloud.
    .replace(",", "");
}

/**
 * "9:00–9:30 AM" — the appointment's own window, in the business's timezone.
 *
 * The calendar event spans the padded BLOCK, so a 30-minute haircut with ten
 * minutes of cleanup shows as a 40-minute event. And Google renders every event
 * in the *viewer's* timezone, so an owner reading a New York calendar from India
 * sees 6:30pm. Both are correct and together they are unreadable: the title has
 * to state the real appointment window, in the business's own clock, or nobody
 * can tell what was actually booked.
 */
export function describeAppointmentWindow(slot: Slot, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  // The meridiem is said once, at the end, unless the window crosses noon.
  const start = fmt.format(slot.start);
  const end = fmt.format(slot.end);
  const [startClock, startMeridiem] = start.split(" ");
  const [, endMeridiem] = end.split(" ");
  return startMeridiem === endMeridiem ? `${startClock}–${end}` : `${start}–${end}`;
}

/** "Sunday 23 August" — for telling a caller which day is closed. */
export function describeDate(dateIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(zonedWallClockToUtc(dateIso, "12:00", timeZone));
}

/**
 * Matches what the caller said to a configured service.
 *
 * Exact, then case-insensitive, then a containment check either way — callers
 * say "a cut" for "Haircut", and speech-to-text rarely returns the catalogue
 * name verbatim. Returns null rather than guessing between two candidates.
 */
export function findService(services: Service[], spoken: string): Service | null {
  const needle = spoken.trim().toLowerCase();
  if (!needle) return null;

  const exact = services.find((s) => s.name.toLowerCase() === needle);
  if (exact) return exact;

  const partial = services.filter(
    (s) => s.name.toLowerCase().includes(needle) || needle.includes(s.name.toLowerCase())
  );
  return partial.length === 1 ? partial[0]! : null;
}
