import { Hono } from "hono";
import type { AppEnv } from "../../types.js";
import { getTenantById, updateTenant } from "@receptionist/core/repositories/tenants.js";
import { listServices } from "@receptionist/core/repositories/services.js";
import { storageConfigured } from "@receptionist/core/providers/storage.js";
import { updateSettingsSchema } from "../../schemas.js";

export const settings = new Hono<AppEnv>()
  .get("/", async (c) => {
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
        recordCalls: tenant.recordCalls,
        storageConfigured,
        phoneNumber: tenant.phoneNumber ?? null,
        calendarProvider: tenant.calendarProvider ?? null,
        calendarExternalId: tenant.calendarExternalId ?? null,
        calendarPayload: tenant.calendarPayload ?? null,
      },
      agent: tenant.agentProfile,
      setup: tenant.setup,
    });
  })
  .patch("/", async (c) => {
    const tenantId = c.get("tenantId");
    const parsed = updateSettingsSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;

    const patch: Record<string, unknown> = {};

    if (body.business) {
      const b = body.business;
      if (b.name !== undefined) patch.name = b.name;
      if (b.industry !== undefined) patch.industry = b.industry;
      if (b.timezone !== undefined) patch.timezone = b.timezone;
      if (b.description !== undefined) patch.description = b.description;
      if (b.businessHours !== undefined) patch.businessHours = b.businessHours;
      if (b.bookingPolicy !== undefined) patch.bookingPolicy = b.bookingPolicy;
      if (b.recordCalls !== undefined) patch.recordCalls = b.recordCalls;
    }

    // Merged rather than replaced, so a partial patch leaves untouched keys alone.
    if (body.agent || body.setup) {
      const tenant = await getTenantById(tenantId);
      if (!tenant) return c.json({ error: "Tenant not found" }, 404);
      if (body.agent) patch.agentProfile = { ...tenant.agentProfile, ...body.agent };
      if (body.setup) patch.setup = { ...tenant.setup, ...body.setup };
    }

    await updateTenant(tenantId, patch);
    return c.json({ updated: true });
  });
