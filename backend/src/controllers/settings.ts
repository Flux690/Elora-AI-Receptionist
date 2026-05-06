import type { AppContext } from "../types.js";
import { getTenantById, updateTenant } from "../services/tenants.js";

export async function getSettings(c: AppContext) {
  const tenantId = c.get("tenantId");
  const tenant = await getTenantById(tenantId);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);
  return c.json({
    name: tenant.name,
    vertical: tenant.vertical,
    timezone: tenant.timezone,
    additionalInstructions: tenant.additionalInstructions,
    businessProfile: tenant.businessProfile,
    googleCalendarId: tenant.googleCalendarId ?? null,
    phoneNumber: tenant.phoneNumber ?? null,
    sipDispatchRuleId: tenant.sipDispatchRuleId ?? null,
  });
}

export async function updateSettings(c: AppContext) {
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{
    name?: string;
    vertical?: "salon" | "spa" | "clinic" | "home_service";
    timezone?: string;
    additionalInstructions?: string;
    businessProfile?: Record<string, unknown>;
    googleCalendarId?: string | null;
  }>();
  await updateTenant(tenantId, body);
  return c.json({ updated: true });
}
