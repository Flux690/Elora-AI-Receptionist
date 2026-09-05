import { clerkMiddleware, getAuth } from "@clerk/hono";
import { createMiddleware } from "hono/factory";
import { resolveTenantByClerkUserId } from "@receptionist/core/repositories/tenants.js";
import type { AppEnv } from "../types.js";

// Verifies the Clerk JWT on every request — reads CLERK_SECRET_KEY from env automatically
export const clerkAuth = clerkMiddleware();

// Resolves the tenant from the verified Clerk userId and injects tenantId into context
export const requireTenant = createMiddleware<AppEnv>(async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const tenant = await resolveTenantByClerkUserId(auth.userId);
  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 404);
  }
  c.set("tenantId", tenant.id);
  await next();
});
