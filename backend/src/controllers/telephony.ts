import type { AppContext } from "../types.js";
import { getTenantById, updateTenant } from "../services/tenants.js";
import { searchPhoneNumbers, purchasePhoneNumber, releasePhoneNumber } from "../services/telephony.js";
import { phoneProvisionSchema } from "../schemas.js";

export async function search(c: AppContext) {
  const areaCode = c.req.query("areaCode") ?? "";
  return c.json(await searchPhoneNumbers(areaCode));
}

export async function provision(c: AppContext) {
  const tenantId = c.get("tenantId");
  const tenant = await getTenantById(tenantId);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  const parsed = phoneProvisionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { phoneNumber } = parsed.data;

  const purchased = await purchasePhoneNumber(phoneNumber);
  try {
    await updateTenant(tenantId, { phoneNumber: purchased.e164_format });
    return c.json({ phoneNumber: purchased.e164_format });
  } catch (dbError) {
    await releasePhoneNumber(purchased.e164_format).catch((e) => console.error("Rollback number fail:", e));
    throw dbError;
  }
}

export async function release(c: AppContext) {
  const tenantId = c.get("tenantId");
  const tenant = await getTenantById(tenantId);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  if (tenant.phoneNumber) await releasePhoneNumber(tenant.phoneNumber).catch((e) => console.error("Release fail:", e));
  await updateTenant(tenantId, { phoneNumber: null });
  return c.json({ ok: true });
}
