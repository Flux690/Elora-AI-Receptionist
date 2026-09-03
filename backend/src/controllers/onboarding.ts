import { getAuth } from "@clerk/hono";
import type { Context } from "hono";
import { createTenant, resolveTenantByClerkUserId } from "../services/tenants.js";
import { replaceServices } from "../services/services.js";
import {
  searchPhoneNumbers,
  purchasePhoneNumber,
  releasePhoneNumber,
  InvalidAreaCode,
} from "../services/telephony.js";
import { onboardingCreateSchema } from "../schemas.js";

/**
 * Whether this account has finished onboarding.
 *
 * Derived from the existence of the tenant row, **not** from Clerk's
 * `publicMetadata.onboarded`. Being onboarded is a fact about the business, not
 * about the identity, and holding it in two places lets them disagree: a tenant
 * created outside this flow leaves the flag false and its owner is sent into
 * onboarding on top of a business that already exists.
 *
 * Sits outside `requireTenant`, which 404s precisely when the answer is "no".
 * PLAN.md 2.1 takes the same view of the flag.
 */
export async function session(c: Context) {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);
  const tenant = await resolveTenantByClerkUserId(auth.userId);
  return c.json({ onboarded: !!tenant });
}

export async function phoneSearch(c: Context) {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    return c.json(await searchPhoneNumbers(c.req.query("areaCode")));
  } catch (err) {
    // The one error here that is the caller's fault rather than the carrier's.
    if (err instanceof InvalidAreaCode) return c.json({ message: err.message }, 400);
    throw err;
  }
}

export async function create(c: Context) {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

  const parsed = onboardingCreateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { phoneNumber, services, ...tenantData } = parsed.data;

  // 0. Refuse a second business for the same account BEFORE buying anything.
  //    `tenants.clerk_user_id` is unique, so a duplicate throws; checking after
  //    the purchase would make a double submit cost a phone number and a release
  //    to undo it, on a release path that is itself unreliable (PLAN.md "Known
  //    limits").
  if (await resolveTenantByClerkUserId(auth.userId)) {
    return c.json({ message: "This account already has a business set up." }, 409);
  }

  // 1. Purchase — if this fails, nothing hits the DB
  const purchased = await purchasePhoneNumber(phoneNumber);

  // 2. Create tenant atomically — if DB fails, release the number.
  //    Services live in their own table now, so they are a second write; it is
  //    inside the same try so a failure still releases the purchased number.
  try {
    const tenant = await createTenant({
      clerkUserId: auth.userId,
      phoneNumber: purchased.e164_format,
      ...tenantData,
    });
    if (services.length > 0) await replaceServices(tenant.id, services);
  } catch (dbErr) {
    await releasePhoneNumber(purchased.e164_format).catch((e) => console.error("[onboarding] rollback release failed:", e));
    throw dbErr;
  }

  return c.json({ ok: true });
}
