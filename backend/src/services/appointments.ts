import { and, asc, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "../db/client.js";
import { appointments } from "../db/schema.js";

export type AppointmentRow = typeof appointments.$inferSelect;

type CreateAppointmentInput = {
  tenantId: string;
  clientId: string | null;
  callerPhone: string | null;
  /** The service record this was booked against; null if it is since deleted. */
  serviceId?: string | null;
  service: string;
  startTime: Date;
  endTime: Date;
  status: "requested" | "confirmed" | "cancelled";
  externalEventId?: string;
};

export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentRow> {
  const rows = await db
    .insert(appointments)
    .values({
      tenantId: input.tenantId,
      clientId: input.clientId,
      callerPhone: input.callerPhone,
      serviceId: input.serviceId ?? null,
      service: input.service,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status,
      externalEventId: input.externalEventId ?? null,
    })
    .returning();
  return rows[0];
}

export async function listAppointments(tenantId: string) {
  return db
    .select({
      id: appointments.id,
      callerPhone: appointments.callerPhone,
      service: appointments.service,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      externalEventId: appointments.externalEventId,
      createdAt: appointments.createdAt,
    })
    .from(appointments)
    .where(eq(appointments.tenantId, tenantId))
    .orderBy(desc(appointments.startTime))
    .limit(100);
}

/**
 * Upcoming appointments for a caller, by their phone number.
 *
 * Takes a non-null `callerPhone` by design. An anonymous caller has no identity
 * to look up, and querying with a placeholder is exactly the bug in PLAN.md
 * 1.8.1 — callers must handle null before reaching here.
 */
export async function getUpcomingByPhone(tenantId: string, callerPhone: string) {
  return db
    .select({
      id: appointments.id,
      service: appointments.service,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      externalEventId: appointments.externalEventId,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.callerPhone, callerPhone),
        gt(appointments.startTime, new Date()),
        ne(appointments.status, "cancelled")
      )
    )
    .orderBy(asc(appointments.startTime))
    .limit(10);
}

export async function cancelAppointmentById(
  appointmentId: string,
  tenantId: string
): Promise<AppointmentRow | null> {
  const rows = await db
    .update(appointments)
    .set({ status: "cancelled" })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)))
    .returning();
  return rows[0] ?? null;
}
