import { getAuth } from "@clerk/hono";
import { createClerkClient } from "@clerk/backend";
import type { Context } from "hono";
import { resolveTenantByClerkUserId, createTenant, updateTenant } from "../services/tenants.js";
import { searchPhoneNumbers, purchasePhoneNumber, releasePhoneNumber } from "../services/telephony.js";
import { env } from "../env.js";
import { onboardingCreateSchema } from "../schemas.js";

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export async function phoneSearch(c: Context) {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);
  const areaCode = c.req.query("areaCode");
  return c.json(await searchPhoneNumbers(areaCode));
}

export async function create(c: Context) {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

  const parsed = onboardingCreateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { phoneNumber, ...tenantData } = parsed.data;

  // Upsert: webhook may or may not have pre-created the row
  let tenant = await resolveTenantByClerkUserId(auth.userId);
  if (tenant) {
    await updateTenant(tenant.id, tenantData);
  } else {
    tenant = await createTenant({ clerkUserId: auth.userId, ...tenantData });
  }

  const purchased = await purchasePhoneNumber(phoneNumber);
  try {
    await updateTenant(tenant.id, { phoneNumber: purchased.e164_format });
  } catch (dbErr) {
    await releasePhoneNumber(purchased.e164_format).catch((e) => console.error("Rollback number fail:", e));
    throw dbErr;
  }

  await clerkClient.users.updateUserMetadata(auth.userId, {
    publicMetadata: { onboarded: true },
  });

  return c.json({ ok: true });
}
