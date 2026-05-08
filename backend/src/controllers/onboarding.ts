import { getAuth } from "@clerk/hono";
import { createClerkClient } from "@clerk/backend";
import type { Context } from "hono";
import { updateTenant, resolveTenantByClerkUserId } from "../services/tenants.js";
import { env } from "../env.js";
import { onboardingCreateSchema } from "../schemas.js";

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export async function create(c: Context) {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

  const existing = await resolveTenantByClerkUserId(auth.userId);
  if (!existing) {
    return c.json({ error: "Tenant not initialized by webhook yet" }, 400);
  }

  const parsed = onboardingCreateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data;

  await updateTenant(existing.id, {
    name: body.name,
    industry: body.industry,
    description: body.description,
    services: body.services,
    timezone: body.timezone,
    agentProfile: body.agentProfile ?? { name: "", greeting: "", farewell: "", fallback: "", holdPhrase: "" },
  });

  await clerkClient.users.updateUserMetadata(auth.userId, {
    publicMetadata: {
      onboarded: true,
    },
  });

  const updated = await resolveTenantByClerkUserId(auth.userId);
  return c.json(updated, 200);
}
