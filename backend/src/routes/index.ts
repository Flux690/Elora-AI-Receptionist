import { Hono } from "hono";
import { clerkMiddleware } from "@clerk/hono";
import healthRoutes from "./health.js";
import adminRoutes from "./admin.js";
import webhooksRouter from "./webhooks.js";
import { create as onboardingCreate } from "../controllers/onboarding.js";

const onboardingRouter = new Hono();
onboardingRouter.use("*", clerkMiddleware());
onboardingRouter.patch("/", onboardingCreate);

export const routes = new Hono()
  .route("/health", healthRoutes)
  .route("/webhooks", webhooksRouter)
  .route("/onboarding", onboardingRouter)
  .route("/admin", adminRoutes);
