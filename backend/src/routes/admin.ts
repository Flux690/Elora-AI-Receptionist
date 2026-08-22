import { Hono } from "hono";
import { clerkAuth, requireTenant } from "../middleware/auth.js";
import * as MetricsController from "../controllers/metrics.js";
import * as EscalationsController from "../controllers/escalations.js";
import * as KnowledgeController from "../controllers/knowledge.js";
import * as CallsController from "../controllers/calls.js";
import * as AppointmentsController from "../controllers/appointments.js";
import * as SettingsController from "../controllers/settings.js";
import * as TelephonyController from "../controllers/telephony.js";
import * as AccountController from "../controllers/account.js";
import * as AgentTestController from "../controllers/agentTest.js";
import * as CalendarController from "../controllers/calendar.js";
import * as ServicesController from "../controllers/services.js";
import type { AppEnv } from "../types.js";

const router = new Hono<AppEnv>();

router.use("*", clerkAuth, requireTenant);

router.get("/metrics", MetricsController.getMetrics);
router.get("/escalations", EscalationsController.list);
router.post("/escalations/:id/resolve", EscalationsController.resolve);
router.get("/knowledge", KnowledgeController.list);
router.delete("/knowledge/:id", KnowledgeController.remove);
router.get("/calls", CallsController.list);
router.get("/calls/:id", CallsController.getById);
router.get("/calls/:id/recording", CallsController.getRecordingUrl);
router.get("/appointments", AppointmentsController.list);
router.get("/settings", SettingsController.getSettings);
router.patch("/settings", SettingsController.updateSettings);
router.get("/phone/search", TelephonyController.search);
router.post("/phone/provision", TelephonyController.provision);
router.delete("/phone", TelephonyController.release);
router.get("/services", ServicesController.list);
router.post("/services", ServicesController.create);
router.patch("/services/:id", ServicesController.update);
router.delete("/services/:id", ServicesController.remove);
router.get("/calendar/list", CalendarController.list);
router.patch("/calendar", CalendarController.select);
router.delete("/calendar", CalendarController.disconnect);
router.post("/agent/test", AgentTestController.createTestSession);
router.delete("/account", AccountController.deleteAccount);

export default router;
