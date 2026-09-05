import { Hono } from "hono";
import { clerkMiddleware, getAuth } from "@clerk/hono";
import { createTenant, resolveTenantByClerkUserId } from "@receptionist/core/repositories/tenants.js";
import { replaceServices } from "@receptionist/core/repositories/services.js";
import {
  searchPhoneNumbers,
  purchasePhoneNumber,
  releasePhoneNumber,
  InvalidAreaCode,
} from "@receptionist/core/providers/telephony.js";
import { onboardingCreateSchema } from "../../schemas.js";

export const onboarding = new Hono()
  .use("*", clerkMiddleware())
  /** Outside requireTenant, which 404s exactly when the answer is no. */
  .get("/session", async (c) => {
    const auth = getAuth(c);
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);
    return c.json({ onboarded: !!(await resolveTenantByClerkUserId(auth.userId)) });
  })
  .get("/phone/search", async (c) => {
    const auth = getAuth(c);
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);
    try {
      return c.json(await searchPhoneNumbers(c.req.query("areaCode")));
    } catch (err) {
      if (err instanceof InvalidAreaCode) return c.json({ message: err.message }, 400);
      throw err;
    }
  })
  .post("/", async (c) => {
    const auth = getAuth(c);
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const parsed = onboardingCreateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const { phoneNumber, services, ...tenantData } = parsed.data;

    // Checked before the purchase, so a double submit cannot cost a number.
    if (await resolveTenantByClerkUserId(auth.userId)) {
      return c.json({ message: "This account already has a business set up." }, 409);
    }

    const purchased = await purchasePhoneNumber(phoneNumber);
    try {
      const tenant = await createTenant({
        clerkUserId: auth.userId,
        phoneNumber: purchased.e164_format,
        ...tenantData,
      });
      if (services.length > 0) await replaceServices(tenant.id, services);
    } catch (dbErr) {
      await releasePhoneNumber(purchased.e164_format).catch((e: unknown) =>
        console.error("[onboarding] rollback release failed:", e)
      );
      throw dbErr;
    }

    return c.json({ ok: true });
  });
