import { serve } from "@hono/node-server";
import { env } from "./env.js";
import { createApp } from "./app.js";

const app = createApp({ allowedOrigins: env.DASHBOARD_ORIGINS });

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`[server] listening on http://localhost:${env.PORT}`);
  console.log(`[server] CORS allowed origins: ${env.DASHBOARD_ORIGINS.join(", ")}`);
});
