import { getAuth } from "@clerk/hono";
import { createClerkClient } from "@clerk/backend";
import type { Context } from "hono";
import { createTenant } from "../services/tenants.js";
import { replaceServices } from "../services/services.js";
import {
  searchPhoneNumbers,
  purchasePhoneNumber,
  releasePhoneNumber,
} from "../services/telephony.js";
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

  const { phoneNumber, services, ...tenantData } = parsed.data;

  // 1. Purchase first — if this fails, nothing hits the DB
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

  // 3. Mark onboarded in Clerk
  await clerkClient.users.updateUserMetadata(auth.userId, {
    publicMetadata: { onboarded: true },
  });

  return c.json({ ok: true });
}
