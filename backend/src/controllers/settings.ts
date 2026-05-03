import type { AppContext } from "../types.js";
import { getTenantById, updateTenant } from "../services/tenants.js";

export async function getSettings(c: AppContext) {
  const tenantId = c.get("tenantId");
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 404);
  }
  return c.json({
    name: tenant.name,
    timezone: tenant.timezone,
    systemPrompt: tenant.systemPrompt,
    businessProfile: tenant.businessProfile,
  });
}

export async function updateSettings(c: AppContext) {
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{
    name?: string;
    timezone?: string;
    systemPrompt?: string;
    businessProfile?: Record<string, unknown>;
  }>();
  await updateTenant(tenantId, body);
  return c.json({ updated: true });
}
