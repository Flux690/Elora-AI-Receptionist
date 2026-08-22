import type { AppContext } from "../types.js";
import { getTenantById, updateTenant } from "../services/tenants.js";
import { listServices } from "../services/services.js";
import { updateSettingsSchema } from "../schemas.js";

export async function getSettings(c: AppContext) {
  const tenantId = c.get("tenantId");
  const [tenant, services] = await Promise.all([
    getTenantById(tenantId),
    listServices(tenantId),
  ]);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  return c.json({
    business: {
      name: tenant.name,
      industry: tenant.industry,
      timezone: tenant.timezone,
      description: tenant.description,
      services,
      businessHours: tenant.businessHours,
      bookingPolicy: tenant.bookingPolicy,
      phoneNumber: tenant.phoneNumber ?? null,
      calendarProvider: tenant.calendarProvider ?? null,
      calendarExternalId: tenant.calendarExternalId ?? null,
      calendarPayload: tenant.calendarPayload ?? null,
    },
    agent: tenant.agentProfile,
  });
}

export async function updateSettings(c: AppContext) {
  const tenantId = c.get("tenantId");
  const parsed = updateSettingsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const patch: Record<string, unknown> = {};

  if (body.business) {
    if (body.business.name !== undefined) patch.name = body.business.name;
    if (body.business.industry !== undefined) patch.industry = body.business.industry;
    if (body.business.timezone !== undefined) patch.timezone = body.business.timezone;
    if (body.business.description !== undefined) patch.description = body.business.description;
    if (body.business.businessHours !== undefined) patch.businessHours = body.business.businessHours;
    if (body.business.bookingPolicy !== undefined) patch.bookingPolicy = body.business.bookingPolicy;
  }

  if (body.agent) {
    const tenant = await getTenantById(tenantId);
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);
    patch.agentProfile = { ...tenant.agentProfile, ...body.agent };
  }

  await updateTenant(tenantId, patch);
  return c.json({ updated: true });
}
