import { serve } from "@hono/node-server";
import { env } from "./env.js";
import { createApp } from "./app.js";
import { closeDb } from "@receptionist/core/db/client.js";

const app = createApp({ allowedOrigins: env.DASHBOARD_ORIGINS });

const server = serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`[server] listening on http://localhost:${env.PORT}`);
  console.log(`[server] CORS allowed origins: ${env.DASHBOARD_ORIGINS.join(", ")}`);
});

/**
 * The HTTP listener and the pool's sockets both hold the event loop open, so a
 * signal has to close them. SIGINT is Ctrl-C, SIGTERM is `concurrently`.
 */
let closing = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  // A second Ctrl-C while the first is still draining should not start a race.
  if (closing) return;
  closing = true;
  console.log(`[server] ${signal} received, shutting down`);

  const timer = setTimeout(() => {
    console.error("[server] did not close in 5s, exiting anyway");
    process.exit(1);
  }, 5_000);
  timer.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await closeDb();
  } catch (err) {
    console.error("[server] error during shutdown:", err);
    process.exit(1);
  }

  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
