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
      origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
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
