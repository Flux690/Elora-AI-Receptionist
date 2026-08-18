import { Hono } from "hono";
import { cors } from "hono/cors";
import { routes } from "./routes/index.js";

export type AppOptions = {
  /**
   * Origins permitted to call the API. Anything else gets no
   * `access-control-allow-origin` header at all, so the browser blocks it.
   */
  allowedOrigins: string[];
};

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Exact match, with one deliberate exception for local development.
 *
 * Vite takes the next free port when its default is busy — 5173 becomes 5174,
 * then 5175 — so pinning one localhost port means `pnpm dev` breaks at random
 * with an opaque CORS failure and a blank dashboard.
 *
 * The exception only applies when a localhost origin was configured in the
 * first place. A production `DASHBOARD_ORIGINS` of real hostnames stays an
 * exact allowlist, and never accepts localhost.
 */
export function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes(origin)) return true;
  if (!allowedOrigins.some((o) => LOCALHOST.test(o))) return false;
  return LOCALHOST.test(origin);
}

/**
 * Builds the API app without binding a port, so tests can drive it through
 * `app.request()` (PLAN.md 1.8.5).
 */
export function createApp({ allowedOrigins }: AppOptions) {
  const app = new Hono();

  // Previously `cors()` with no options, which answers every origin with `*` on
  // every route, including /api/admin/*. Scoped to the dashboard instead.
  app.use(
    "*",
    cors({
      origin: (origin) => (isAllowedOrigin(origin, allowedOrigins) ? origin : null),
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 86_400,
    })
  );

  app.route("/api", routes);

  app.onError((err, c) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[server] unhandled error:", err);
    return c.json({ error: message }, 500);
  });

  return app;
}
