import { getAuth } from "@clerk/hono";
import { createClerkClient } from "@clerk/backend";
import type { AppContext } from "../types.js";
import { getTenantById, deleteTenant } from "../services/tenants.js";
import { releasePhoneNumber, deleteSipDispatchRule } from "../services/telephony.js";
import { env } from "../env.js";

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export async function deleteAccount(c: AppContext) {
  const auth = getAuth(c);
  const tenantId = c.get("tenantId");

  const tenant = await getTenantById(tenantId);
  if (tenant?.phoneNumber) await releasePhoneNumber(tenant.phoneNumber).catch((e) => console.error("Release fail:", e));
  if (tenant?.sipDispatchRuleId) await deleteSipDispatchRule(tenant.sipDispatchRuleId).catch((e) => console.error("Release fail:", e));

  await deleteTenant(tenantId);
  await clerkClient.users.deleteUser(auth!.userId!);

  return c.json({ ok: true });
}
