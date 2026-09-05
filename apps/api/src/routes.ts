import { Hono } from "hono";
import type { AppEnv } from "./types.js";
import { clerkAuth, requireTenant } from "./middleware/auth.js";
import { health } from "./modules/health/route.js";
import { onboarding } from "./modules/onboarding/route.js";
import { metrics } from "./modules/metrics/route.js";
import { calls } from "./modules/calls/route.js";
import { escalations } from "./modules/escalations/route.js";
import { knowledge } from "./modules/knowledge/route.js";
import { appointments } from "./modules/appointments/route.js";
import { services } from "./modules/services/route.js";
import { settings } from "./modules/settings/route.js";
import { calendar } from "./modules/calendar/route.js";
import { telephony } from "./modules/telephony/route.js";
import { agent } from "./modules/agent/route.js";

const admin = new Hono<AppEnv>()
  .use("*", clerkAuth, requireTenant)
  .route("/metrics", metrics)
  .route("/calls", calls)
  .route("/escalations", escalations)
  .route("/knowledge", knowledge)
  .route("/appointments", appointments)
  .route("/services", services)
  .route("/settings", settings)
  .route("/calendar", calendar)
  .route("/phone", telephony)
  .route("/agent", agent);

export const routes = new Hono()
  .route("/health", health)
  .route("/onboarding", onboarding)
  .route("/admin", admin);

export type AppRoutes = typeof routes;
