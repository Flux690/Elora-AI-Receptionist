import { Hono } from "hono";
import { clerkMiddleware } from "@clerk/hono";
import healthRoutes from "./health.js";
import adminRoutes from "./admin.js";
import { create as onboardingCreate, phoneSearch as onboardingPhoneSearch } from "../controllers/onboarding.js";

const onboardingRouter = new Hono();
onboardingRouter.use("*", clerkMiddleware());
onboardingRouter.post("/", onboardingCreate);
onboardingRouter.get("/phone/search", onboardingPhoneSearch);

export const routes = new Hono()
  .route("/health", healthRoutes)
  .route("/onboarding", onboardingRouter)
  .route("/admin", adminRoutes);
