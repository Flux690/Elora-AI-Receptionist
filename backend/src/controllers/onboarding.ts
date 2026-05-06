import { getAuth } from "@clerk/hono";
import { createClerkClient } from "@clerk/backend";
import type { Context } from "hono";
import { updateTenant, resolveTenantByClerkUserId } from "../services/tenants.js";
import { env } from "../env.js";

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export async function create(c: Context) {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

  const existing = await resolveTenantByClerkUserId(auth.userId);
  if (!existing) {
    return c.json({ error: "Tenant not initialized by webhook yet" }, 400);
  }

  const body = await c.req.json<{
    name: string;
    vertical: "salon" | "spa" | "clinic" | "home_service";
    timezone: string;
  }>();

  await updateTenant(existing.id, {
    name: body.name ?? "",
    vertical: body.vertical ?? "salon",
    timezone: body.timezone ?? "UTC",
  });

  await clerkClient.users.updateUserMetadata(auth.userId, {
    publicMetadata: {
      onboarded: true,
    },
  });

  // Fetch it again to return the full object
  const updated = await resolveTenantByClerkUserId(auth.userId);
  return c.json(updated, 200);
}
