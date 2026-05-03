import { Hono } from "hono";
import { clerkAuth, requireTenant } from "../../middleware/auth.js";
import adminRoutes from "./routes.js";
import type { AppEnv } from "../../types.js";

const router = new Hono<AppEnv>();

router.use("*", clerkAuth, requireTenant);
router.route("/", adminRoutes);

export default router;
