import { Hono } from "hono";
import type { AppEnv } from "../../types.js";
import { getTenantById, updateTenant } from "@receptionist/core/repositories/tenants.js";
import {
  searchPhoneNumbers,
  purchasePhoneNumber,
  releasePhoneNumber,
  InvalidAreaCode,
} from "@receptionist/core/providers/telephony.js";
import { phoneProvisionSchema } from "../../schemas.js";

export const telephony = new Hono<AppEnv>()
  .get("/search", async (c) => {
    try {
      return c.json(await searchPhoneNumbers(c.req.query("areaCode")));
    } catch (err) {
      if (err instanceof InvalidAreaCode) return c.json({ message: err.message }, 400);
      throw err;
    }
  })
  .post("/provision", async (c) => {
    const tenantId = c.get("tenantId");
    const tenant = await getTenantById(tenantId);
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);

    const parsed = phoneProvisionSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const purchased = await purchasePhoneNumber(parsed.data.phoneNumber);
    try {
      await updateTenant(tenantId, { phoneNumber: purchased.e164_format });
    } catch (dbErr) {
      await releasePhoneNumber(purchased.e164_format).catch((e: unknown) =>
        console.error("[telephony] rollback release failed:", e)
      );
      throw dbErr;
    }

    return c.json({ phoneNumber: purchased.e164_format });
  })
  .delete("/", async (c) => {
    const tenantId = c.get("tenantId");
    const tenant = await getTenantById(tenantId);
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);

    if (tenant.phoneNumber) {
      await releasePhoneNumber(tenant.phoneNumber).catch((e: unknown) =>
        console.error("[telephony] release failed:", e)
      );
    }

    await updateTenant(tenantId, { phoneNumber: null });
    return c.json({ ok: true });
  });
