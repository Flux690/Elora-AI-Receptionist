import { Hono } from "hono";
import { clerkMiddleware } from "@clerk/hono";
import healthRoutes from "./health.js";
import adminRoutes from "./admin.js";
import {
  create as onboardingCreate,
  phoneSearch as onboardingPhoneSearch,
  session as onboardingSession,
} from "../controllers/onboarding.js";

const onboardingRouter = new Hono();
onboardingRouter.use("*", clerkMiddleware());
onboardingRouter.post("/", onboardingCreate);
onboardingRouter.get("/phone/search", onboardingPhoneSearch);
// Outside requireTenant on purpose: it answers whether a tenant exists at all.
onboardingRouter.get("/session", onboardingSession);

export const routes = new Hono()
  .route("/health", healthRoutes)
  .route("/onboarding", onboardingRouter)
  .route("/admin", adminRoutes);
