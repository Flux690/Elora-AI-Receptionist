import { clerkMiddleware, getAuth } from "@clerk/hono";
import { createMiddleware } from "hono/factory";
import { resolveAgentByClerkUserId } from "@receptionist/core/repositories/agents.js";
import type { AppEnv } from "../types.js";

// Verifies the Clerk JWT on every request — reads CLERK_SECRET_KEY from env automatically
export const clerkAuth = clerkMiddleware();

// Resolves the agent from the verified Clerk userId and injects agentId into context
export const requireAgent = createMiddleware<AppEnv>(async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const agent = await resolveAgentByClerkUserId(auth.userId);
  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }
  c.set("agentId", agent.id);
  await next();
});
