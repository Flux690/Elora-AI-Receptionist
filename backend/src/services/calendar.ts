const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export type CalendarSlot = { start: string; end: string };

export async function checkAvailability(
  accessToken: string,
  calendarId: string,
  startIso: string,
  endIso: string,
  slotMinutes = 60
): Promise<CalendarSlot[]> {
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: startIso,
      timeMax: endIso,
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[calendar] freeBusy failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    calendars: Record<string, { busy: { start: string; end: string }[] }>;
  };

  const busy = data.calendars[calendarId]?.busy ?? [];

  // Generate all slot candidates within the window
  const slots: CalendarSlot[] = [];
  const windowStart = new Date(startIso).getTime();
  const windowEnd = new Date(endIso).getTime();
  const slotMs = slotMinutes * 60 * 1000;

  for (let t = windowStart; t + slotMs <= windowEnd; t += slotMs) {
    const slotStart = new Date(t);
    const slotEnd = new Date(t + slotMs);

    const overlaps = busy.some((b) => {
      const busyStart = new Date(b.start).getTime();
      const busyEnd = new Date(b.end).getTime();
      return slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart;
    });

    if (!overlaps) {
      slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
    }
  }

  return slots;
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    startIso: string;
    endIso: string;
    timezone: string;
    description?: string;
  }
): Promise<string> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description ?? "Booked via AI Receptionist",
        start: { dateTime: event.startIso, timeZone: event.timezone },
        end: { dateTime: event.endIso, timeZone: event.timezone },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[calendar] createEvent failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 410) {
    const body = await res.text();
    throw new Error(`[calendar] deleteEvent failed: ${res.status} ${body}`);
  }
}
