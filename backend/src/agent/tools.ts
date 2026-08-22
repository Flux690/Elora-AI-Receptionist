import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentDeps } from "./types.js";
import { createEscalation } from "../services/escalations.js";
import { setClientName } from "../services/clients.js";
import { fetchBusyRanges, createCalendarEvent, deleteCalendarEvent } from "../services/calendar.js";
import {
  describeDate,
  describeSlot,
  filterByBusy,
  findService,
  generateCandidateSlots,
  isOpenOn,
} from "./scheduling.js";
import { createAppointment, getUpcomingByPhone, cancelAppointmentById } from "../services/appointments.js";

/** How many times the agent reads out at once. More than three is unfollowable. */
const MAX_SLOTS_OFFERED = 3;

/** How far ahead to search when the caller did not name a day. */
const DEFAULT_SEARCH_DAYS = 14;

export function createAgentTools(deps: AgentDeps) {
  const holdPhrase = deps.tenant.agentProfile.holdPhrase;
  const tenantId = deps.tenant.id;
  const timeZone = deps.tenant.timezone;

  function sayHold(ctx: voice.RunContext) {
    if (!holdPhrase) return;
    ctx.session.say(holdPhrase);
  }

  return {
    createEscalation: llm.tool({
      description:
        "Escalate a question you cannot answer to the business team. Use this when the answer is not in your instructions or knowledge base. Do not escalate the same question twice.",
      parameters: z.object({
        question: z.string().describe("The caller's question, as asked."),
        transcriptExcerpt: z
          .string()
          .nullable()
          .describe("A short excerpt of recent conversation for context."),
      }),
      execute: async ({ question, transcriptExcerpt }, { ctx }) => {
        ctx.speechHandle.allowInterruptions = false;
        // DB writes are deferred until after the greeting, so the calls row may
        // not exist yet — and escalations.call_id is a foreign key to it. Wait
        // for it rather than moving the write onto the path to first audio.
        // Normally resolved seconds ago, so this costs nothing (PLAN.md 1.7.3).
        const callRowExists = await deps.callRowReady;
        await createEscalation({
          tenantId,
          // Unlinked rather than lost: without the row, the FK would reject the
          // insert and the tool would throw mid-call.
          callId: callRowExists ? deps.callId : null,
          clientId: deps.client?.id ?? null,
          callerPhone: deps.callerPhone,
          question,
          transcriptExcerpt,
        });
        deps.callState.wasEscalated = true;
        return { escalated: true };
      },
    }),

    rememberCallerName: llm.tool({
      description:
        "Save the caller's name once they have given it, so they are recognised on future calls and their bookings are titled correctly. Call this at most once per call, and only with a name the caller actually stated.",
      parameters: z.object({
        name: z.string().describe("The caller's name exactly as they gave it."),
      }),
      execute: async ({ name }) => {
        // No client row for an anonymous caller, so there is nothing to attach
        // a name to. Say nothing to the caller about it.
        if (!deps.client) return { saved: false };

        const updated = await setClientName(tenantId, deps.client.id, name);
        if (!updated) return { saved: false };

        // Keep in-memory deps in step so the rest of this call uses the name.
        deps.client = updated;
        return { saved: true };
      },
    }),

    checkAvailability: llm.tool({
      description:
        "Find real appointment times for a service. Always call this before offering any time to a caller. It returns slots with ids; read the times out and remember the ids.",
      parameters: z.object({
        service: z.string().describe("The service the caller wants, as they said it."),
        preferredDate: z
          .string()
          .nullable()
          .describe("The date the caller asked for, as YYYY-MM-DD. Null if they did not name one."),
        partOfDay: z
          .enum(["morning", "afternoon", "evening"])
          .nullable()
          .describe("Only if the caller asked for one. Null otherwise."),
      }),
      execute: async ({ service, preferredDate, partOfDay }, { ctx }) => {
        if (!deps.calendarExternalId) {
          return {
            error:
              "No calendar is connected, so times cannot be checked. Create an escalation so the team can follow up.",
          };
        }

        const matched = findService(deps.services, service);
        if (!matched) {
          // Never guess a service: the wrong one means the wrong length, and
          // therefore a slot the business cannot honour.
          return {
            error: `"${service}" is not on the service list. Ask the caller which service they mean, from: ${deps.services
              .map((s) => s.name)
              .join(", ")}.`,
          };
        }

        // sayHold fires FIRST — before any await — so the caller hears it immediately
        sayHold(ctx);
        const token = await deps.getGoogleToken();
        if (!token) {
          return { error: "Calendar authentication unavailable. Create an escalation." };
        }

        const now = new Date();
        const hours = deps.tenant.businessHours;
        const policy = deps.tenant.bookingPolicy;

        // A closed day is not a dead end. Say so, then keep looking forward —
        // the caller still wants an appointment.
        const closedNote =
          preferredDate && !isOpenOn(hours, preferredDate)
            ? `The business is closed on ${describeDate(preferredDate, timeZone)}. Say so, then offer these instead.`
            : undefined;

        const candidates = generateCandidateSlots({
          hours,
          policy,
          service: matched,
          timeZone,
          now,
          fromDate: preferredDate ?? undefined,
          days: preferredDate && !closedNote ? 0 : DEFAULT_SEARCH_DAYS,
          partOfDay,
        });

        if (candidates.length === 0) {
          return {
            slots: [],
            note: `No times are available${
              preferredDate ? ` around ${describeDate(preferredDate, timeZone)}` : ""
            }. Offer to have the team call back, or create an escalation.`,
          };
        }

        let free = candidates;
        try {
          const busy = await fetchBusyRanges(
            token,
            deps.calendarExternalId,
            candidates[0]!.blockStart.toISOString(),
            candidates.at(-1)!.blockEnd.toISOString()
          );
          free = filterByBusy(candidates, busy);
        } catch (err) {
          console.error("[agent] freeBusy lookup failed:", err);
          return { error: "Could not check the calendar. Create an escalation." };
        }

        if (free.length === 0) {
          return {
            slots: [],
            note: "Everything in that window is booked. Offer a different day.",
          };
        }

        const offered = free.slice(0, MAX_SLOTS_OFFERED).map((slot) => {
          const slotId = `slot_${deps.slots.nextId++}`;
          deps.slots.held.set(slotId, { slot, service: matched });
          return { slotId, time: describeSlot(slot, timeZone) };
        });

        return {
          service: matched.name,
          slots: offered,
          ...(closedNote ? { note: closedNote } : {}),
        };
      },
    }),

    bookAppointment: llm.tool({
      description:
        "Book one of the slots returned by checkAvailability, using its slotId. Only call this once the caller has confirmed a specific time. Never invent a slotId.",
      parameters: z.object({
        slotId: z.string().describe("The slotId of the time the caller chose."),
      }),
      execute: async ({ slotId }, { ctx }) => {
        const held = deps.slots.held.get(slotId);
        if (!held) {
          // The model made one up, or referred to an offer from before a
          // re-check. Either way, do not book something never offered.
          return {
            error:
              "That time is no longer held. Call checkAvailability again and offer the caller a fresh set of times.",
          };
        }

        // sayHold fires FIRST — before any await — so the caller hears it immediately
        sayHold(ctx);
        const { slot, service } = held;
        const token = await deps.getGoogleToken();

        const appointmentBase = {
          tenantId,
          clientId: deps.client?.id ?? null,
          callerPhone: deps.callerPhone,
          serviceId: service.id,
          service: service.name,
          startTime: slot.start,
          endTime: slot.end,
        };

        if (!token || !deps.calendarExternalId) {
          await createAppointment({ ...appointmentBase, status: "requested" });
          deps.callState.wasBooked = true;
          return {
            booked: false,
            reason: "Calendar not connected — appointment request saved, team will confirm.",
          };
        }

        try {
          // Re-check immediately before writing. The slot was computed when the
          // caller was still deciding, and somebody may have taken it since —
          // a walk-in, or the owner booking it by hand.
          const busy = await fetchBusyRanges(
            token,
            deps.calendarExternalId,
            slot.blockStart.toISOString(),
            slot.blockEnd.toISOString()
          );
          if (filterByBusy([slot], busy).length === 0) {
            deps.slots.held.delete(slotId);
            return {
              error:
                "That time was taken while you were talking. Call checkAvailability again and offer what is left.",
            };
          }

          const padded =
            service.bufferBeforeMinutes > 0 || service.bufferAfterMinutes > 0
              ? ` (appointment ${describeSlot(slot, timeZone)}; includes setup and cleanup)`
              : "";

          const eventId = await createCalendarEvent(token, deps.calendarExternalId, {
            summary: `${service.name} — ${deps.client?.name ?? deps.callerPhone ?? "caller ID withheld"}`,
            // The block, not the appointment: the event must reserve setup and
            // cleanup or the next booking lands on top of them.
            startIso: slot.blockStart.toISOString(),
            endIso: slot.blockEnd.toISOString(),
            timezone: timeZone,
            description: `Booked by the AI receptionist${padded}`,
          });

          await createAppointment({
            ...appointmentBase,
            status: "confirmed",
            externalEventId: eventId,
          });
          deps.callState.wasBooked = true;
          deps.slots.held.delete(slotId);

          return { booked: true, time: describeSlot(slot, timeZone) };
        } catch (err) {
          console.error("[agent] bookAppointment failed:", err);
          await createAppointment({ ...appointmentBase, status: "requested" });
          deps.callState.wasBooked = true;
          return {
            booked: false,
            reason: "Booking failed — appointment request saved, team will confirm.",
          };
        }
      },
    }),

    lookupAppointments: llm.tool({
      description:
        "Look up a caller's upcoming appointments by their phone number. Use when a caller asks about existing bookings or wants to cancel/reschedule.",
      parameters: z.object({}),
      execute: async (_params, { ctx }) => {
        // Anonymous caller: there is no identity to look up. Ask for a number
        // rather than querying with a placeholder — a shared placeholder key is
        // how one caller's appointments got read to another (PLAN.md 1.8.1).
        if (!deps.callerPhone) {
          return {
            appointments: [],
            message:
              "This caller's number is withheld, so their bookings cannot be looked up. " +
              "Ask the caller to read out the phone number their appointment was booked under.",
          };
        }
        sayHold(ctx);
        const upcoming = await getUpcomingByPhone(tenantId, deps.callerPhone);
        if (upcoming.length === 0) return { appointments: [], message: "No upcoming appointments found." };
        return {
          appointments: upcoming.map((a) => ({
            id: a.id,
            service: a.service,
            startTime: a.startTime?.toISOString() ?? null,
            endTime: a.endTime?.toISOString() ?? null,
            status: a.status,
          })),
        };
      },
    }),

    cancelAppointment: llm.tool({
      description:
        "Cancel a confirmed appointment. Only call after you have read the appointment details back to the caller and they explicitly confirmed they want to cancel.",
      parameters: z.object({
        appointmentId: z.string().describe("The ID of the appointment to cancel."),
      }),
      execute: async ({ appointmentId }, { ctx }) => {
        sayHold(ctx);
        const cancelled = await cancelAppointmentById(appointmentId, tenantId);
        if (!cancelled) return { error: "Appointment not found." };

        if (cancelled.externalEventId && deps.calendarExternalId) {
          const token = await deps.getGoogleToken();
          if (token) {
            try {
              await deleteCalendarEvent(token, deps.calendarExternalId, cancelled.externalEventId);
            } catch (err) {
              console.error("[agent] deleteCalendarEvent failed:", err);
            }
          }
        }

        return { cancelled: true, appointmentId };
      },
    }),

    endCall: llm.tool({
      description:
        "End the phone call. Use only after the caller has clearly indicated they are done — for example, said goodbye, thank you, or that's all.",
      parameters: z.object({}),
      execute: async (_params, { ctx }) => {
        const farewell = deps.tenant.agentProfile.farewell;
        if (farewell) {
          ctx.session.say(farewell, { allowInterruptions: false });
        }
        ctx.session.shutdown({ drain: true });
      },
    }),
  };
}
