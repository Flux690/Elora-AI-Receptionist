import { and, asc, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "../db/client.js";
import { appointments } from "../db/schema.js";

export type AppointmentRow = typeof appointments.$inferSelect;

type CreateAppointmentInput = {
  tenantId: string;
  clientId: string | null;
  callerPhone: string;
  service: string;
  startTime: Date;
  endTime: Date;
  status: "requested" | "confirmed" | "cancelled";
  googleEventId?: string;
};

export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentRow> {
  const rows = await db
    .insert(appointments)
    .values({
      tenantId: input.tenantId,
      clientId: input.clientId,
      callerPhone: input.callerPhone,
      service: input.service,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status,
      googleEventId: input.googleEventId ?? null,
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
      googleEventId: appointments.googleEventId,
      createdAt: appointments.createdAt,
    })
    .from(appointments)
    .where(eq(appointments.tenantId, tenantId))
    .orderBy(desc(appointments.startTime))
    .limit(100);
}

export async function getNextAppointment(
  tenantId: string,
  clientId: string
): Promise<AppointmentRow | null> {
  const rows = await db
    .select({
      id: appointments.id,
      service: appointments.service,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.clientId, clientId),
        gt(appointments.startTime, new Date()),
        ne(appointments.status, "cancelled")
      )
    )
    .orderBy(asc(appointments.startTime))
    .limit(1);
  return (rows[0] as AppointmentRow | undefined) ?? null;
}

export async function getUpcomingByPhone(tenantId: string, callerPhone: string) {
  return db
    .select({
      id: appointments.id,
      service: appointments.service,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      googleEventId: appointments.googleEventId,
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
