import type { AppContext } from "../types.js";
import { getTenantById, updateTenant } from "../services/tenants.js";
import {
  searchPhoneNumbers,
  purchasePhoneNumber,
  releasePhoneNumber,
  createSipDispatchRule,
  deleteSipDispatchRule,
} from "../services/telephony.js";

export async function search(c: AppContext) {
  const areaCode = c.req.query("areaCode") ?? "";
  const numbers = await searchPhoneNumbers(areaCode);
  return c.json(numbers);
}

export async function provision(c: AppContext) {
  const tenantId = c.get("tenantId");
  const tenant = await getTenantById(tenantId);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  const { phoneNumber } = await c.req.json<{ phoneNumber: string }>();

  const sipDispatchRuleId = await createSipDispatchRule(tenantId);

  try {
    const purchased = await purchasePhoneNumber(phoneNumber, sipDispatchRuleId);

    try {
      await updateTenant(tenantId, { phoneNumber: purchased.e164_format, sipDispatchRuleId });
      return c.json({ phoneNumber: purchased.e164_format, sipDispatchRuleId });
    } catch (dbError) {
      // Rollback the number if DB save fails
      await releasePhoneNumber(purchased.e164_format).catch(e => console.error("Rollback number fail:", e));
      throw dbError;
    }
  } catch (error) {
    // Rollback the dispatch rule if anything failed
    await deleteSipDispatchRule(sipDispatchRuleId).catch(e => console.error("Rollback rule fail:", e));
    throw error;
  }
}

export async function release(c: AppContext) {
  const tenantId = c.get("tenantId");
  const tenant = await getTenantById(tenantId);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  if (tenant.phoneNumber) await releasePhoneNumber(tenant.phoneNumber).catch((e) => console.error("Release fail:", e));
  if (tenant.sipDispatchRuleId) await deleteSipDispatchRule(tenant.sipDispatchRuleId).catch((e) => console.error("Release fail:", e));

  await updateTenant(tenantId, { phoneNumber: null, sipDispatchRuleId: null });
  return c.json({ ok: true });
}
