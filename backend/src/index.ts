import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { routes } from "./routes/index.js";

const app = new Hono();

app.use("*", cors());
app.route("/api", routes);

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[server] unhandled error:", err);
  return c.json({ error: message }, 500);
});

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`[server] listening on http://localhost:${env.PORT}`);
});
