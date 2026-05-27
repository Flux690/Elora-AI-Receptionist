import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentDeps } from "./types.js";
import { searchKnowledge } from "../services/knowledge.js";
import { createEscalation } from "../services/escalations.js";
import { checkAvailability, createCalendarEvent, deleteCalendarEvent } from "../services/calendar.js";
import { createAppointment, getUpcomingByPhone, cancelAppointmentById } from "../services/appointments.js";

export function createAgentTools(deps: AgentDeps) {
  const holdPhrase = deps.tenant.agentProfile.holdPhrase;
  const tenantId = deps.tenant.id;

  function sayHold(ctx: voice.RunContext) {
    if (!holdPhrase) return;
    ctx.session.say(holdPhrase);
  }

  return {
    searchKnowledge: llm.tool({
      description:
        "Search the knowledge base for an answer to a caller's question about the business — services, pricing, hours, policies, or anything else not already known from context.",
      parameters: z.object({
        query: z.string().describe("The caller's question, verbatim or closely paraphrased."),
      }),
      execute: async ({ query }, { ctx }) => {
        sayHold(ctx);
        const results = await searchKnowledge(tenantId, query);
        if (results.length === 0) return null;
        return results.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join("\n---\n");
      },
    }),

    createEscalation: llm.tool({
      description:
        "Escalate a question you cannot answer to the business team. Use this when search_knowledge returns nothing useful and you cannot answer from context. Do not escalate the same question twice.",
      parameters: z.object({
        question: z.string().describe("The caller's question, as asked."),
        transcriptExcerpt: z
          .string()
          .nullable()
          .describe("A short excerpt of recent conversation for context."),
      }),
      execute: async ({ question, transcriptExcerpt }, { ctx }) => {
        ctx.speechHandle.allowInterruptions = false;
        await createEscalation({
          tenantId,
          callId: deps.callId,
          clientId: deps.client?.id ?? null,
          callerPhone: deps.callerPhone,
          question,
          transcriptExcerpt,
        });
        deps.callState.wasEscalated = true;
        return { escalated: true };
      },
    }),

    checkAvailability: llm.tool({
      description:
        "Check available appointment slots on the business calendar. Always call this before offering specific times to a caller who wants to book.",
      parameters: z.object({
        service: z.string().describe("The service the caller wants to book."),
        startIso: z
          .string()
          .describe("Start of the search window in ISO 8601 format, adjusted to the business timezone."),
        endIso: z
          .string()
          .describe("End of the search window in ISO 8601 format."),
      }),
      execute: async ({ startIso, endIso }, { ctx }) => {
        // sayHold fires FIRST — before any await — so the caller hears it immediately
        if (!deps.googleCalendarId) {
          return {
            error: "Calendar not connected. Create an escalation so the team can follow up with the caller.",
          };
        }
        sayHold(ctx);
        const token = await deps.getGoogleToken();
        if (!token) {
          return { error: "Calendar authentication unavailable. Create an escalation." };
        }
        try {
          const slots = await checkAvailability(token, deps.googleCalendarId, startIso, endIso);
          return { available: slots.slice(0, 5) };
        } catch (err) {
          console.error("[agent] checkAvailability failed:", err);
          return { error: "Could not check availability. Create an escalation." };
        }
      },
    }),

    bookAppointment: llm.tool({
      description:
        "Book a confirmed appointment after the caller has chosen a specific slot. Do not call this until the caller has explicitly confirmed the time.",
      parameters: z.object({
        service: z.string().describe("The service being booked."),
        startIso: z.string().describe("Confirmed slot start in ISO 8601."),
        endIso: z.string().describe("Confirmed slot end in ISO 8601."),
      }),
      execute: async ({ service, startIso, endIso }, { ctx }) => {
        // sayHold fires FIRST — before any await — so the caller hears it immediately
        sayHold(ctx);
        const token = await deps.getGoogleToken();
        if (!token || !deps.googleCalendarId) {
          await createAppointment({
            tenantId,
            clientId: deps.client?.id ?? null,
            callerPhone: deps.callerPhone,
            service,
            startTime: new Date(startIso),
            endTime: new Date(endIso),
            status: "requested",
          });
          deps.callState.wasBooked = true;
          return {
            booked: false,
            reason: "Calendar not connected — appointment request saved, team will confirm.",
          };
        }
        try {
          const eventId = await createCalendarEvent(token, deps.googleCalendarId, {
            summary: `${service} — ${deps.client?.name ?? deps.callerPhone}`,
            startIso,
            endIso,
            timezone: deps.tenant.timezone,
          });
          await createAppointment({
            tenantId,
            clientId: deps.client?.id ?? null,
            callerPhone: deps.callerPhone,
            service,
            startTime: new Date(startIso),
            endTime: new Date(endIso),
            status: "confirmed",
            googleEventId: eventId,
          });
          deps.callState.wasBooked = true;
          return { booked: true, eventId };
        } catch (err) {
          console.error("[agent] bookAppointment failed:", err);
          await createAppointment({
            tenantId,
            clientId: deps.client?.id ?? null,
            callerPhone: deps.callerPhone,
            service,
            startTime: new Date(startIso),
            endTime: new Date(endIso),
            status: "requested",
          });
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

        if (cancelled.googleEventId && deps.googleCalendarId) {
          const token = await deps.getGoogleToken();
          if (token) {
            try {
              await deleteCalendarEvent(token, deps.googleCalendarId, cancelled.googleEventId);
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
