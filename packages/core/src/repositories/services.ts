import { and, asc, eq, max } from "drizzle-orm";
import type { Service, ServiceDraft } from "@receptionist/shared";
import { db } from "../db/client.js";
import { services } from "../db/schema.js";

export type ServiceRow = typeof services.$inferSelect;

const serviceFields = {
  id: services.id,
  name: services.name,
  price: services.price,
  description: services.description,
  durationMinutes: services.durationMinutes,
  bufferBeforeMinutes: services.bufferBeforeMinutes,
  bufferAfterMinutes: services.bufferAfterMinutes,
  requiredResources: services.requiredResources,
} as const;

/**
 * A tenant's services, in display order.
 *
 * Read on every call (they go into the system prompt and into the STT keyterm
 * list) and on every Settings load, so the projection deliberately omits
 * `position`, `createdAt` and `updatedAt` — none of which the agent needs.
 */
export async function listServices(tenantId: string): Promise<Service[]> {
  const rows = await db
    .select(serviceFields)
    .from(services)
    .where(eq(services.tenantId, tenantId))
    .orderBy(asc(services.position), asc(services.createdAt));

  return rows.map((row) => ({
    ...row,
    description: row.description || undefined,
  }));
}

export async function createService(
  tenantId: string,
  draft: ServiceDraft
): Promise<Service> {
  // Append rather than insert at zero: a new service showing up at the top of
  // someone's list is a small surprise nobody asked for.
  const [{ value: highest }] = await db
    .select({ value: max(services.position) })
    .from(services)
    .where(eq(services.tenantId, tenantId));

  const rows = await db
    .insert(services)
    .values({
      tenantId,
      name: draft.name,
      price: draft.price,
      description: draft.description ?? "",
      durationMinutes: draft.durationMinutes,
      bufferBeforeMinutes: draft.bufferBeforeMinutes,
      bufferAfterMinutes: draft.bufferAfterMinutes,
      requiredResources: draft.requiredResources,
      position: (highest ?? -1) + 1,
    })
    .returning(serviceFields);

  const row = rows[0]!;
  return { ...row, description: row.description || undefined };
}

export async function updateService(
  tenantId: string,
  id: string,
  patch: Partial<ServiceDraft>
): Promise<Service | null> {
  const rows = await db
    .update(services)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(services.id, id), eq(services.tenantId, tenantId)))
    .returning(serviceFields);

  const row = rows[0];
  return row ? { ...row, description: row.description || undefined } : null;
}

/**
 * Deletes a service.
 *
 * Appointments booked against it survive: `appointments.service_id` is
 * `ON DELETE SET NULL` and `appointments.service` still holds the name as it
 * stood at booking time. A deleted service must not erase the record of what
 * someone booked — they are still turning up for it.
 */
export async function deleteService(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(services)
    .where(and(eq(services.id, id), eq(services.tenantId, tenantId)))
    .returning({ id: services.id });

  return rows.length > 0;
}

/**
 * Replaces a tenant's whole service list in one transaction.
 *
 * Onboarding submits several services at once, and doing that as N separate
 * inserts leaves a half-built list behind if one fails.
 */
export async function replaceServices(
  tenantId: string,
  drafts: ServiceDraft[]
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(services).where(eq(services.tenantId, tenantId));
    if (drafts.length === 0) return;

    await tx.insert(services).values(
      drafts.map((draft, position) => ({
        tenantId,
        name: draft.name,
        price: draft.price,
        description: draft.description ?? "",
        durationMinutes: draft.durationMinutes,
        bufferBeforeMinutes: draft.bufferBeforeMinutes,
        bufferAfterMinutes: draft.bufferAfterMinutes,
        requiredResources: draft.requiredResources,
        position,
      }))
    );
  });
}
