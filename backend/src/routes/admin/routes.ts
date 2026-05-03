import { Hono } from "hono";
import * as MetricsController from "../../controllers/metrics.js";
import * as EscalationsController from "../../controllers/escalations.js";
import * as KnowledgeController from "../../controllers/knowledge.js";
import * as CallsController from "../../controllers/calls.js";
import * as SettingsController from "../../controllers/settings.js";
import type { AppEnv } from "../../types.js";

const router = new Hono<AppEnv>();

router.get("/metrics", MetricsController.getMetrics);
router.get("/escalations", EscalationsController.list);
router.post("/escalations/:id/resolve", EscalationsController.resolve);
router.get("/knowledge", KnowledgeController.list);
router.delete("/knowledge/:id", KnowledgeController.remove);
router.get("/calls", CallsController.list);
router.get("/settings", SettingsController.getSettings);
router.patch("/settings", SettingsController.updateSettings);

export default router;
