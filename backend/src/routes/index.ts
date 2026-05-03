import { Hono } from "hono";
import healthRoutes from "./health.js";
import adminRoutes from "./admin/index.js";

export const routes = new Hono()
  .route("/health", healthRoutes)
  .route("/admin", adminRoutes);
