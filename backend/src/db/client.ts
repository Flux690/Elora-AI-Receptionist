import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { env } from "../env.js";

/**
 * Pool tuning (PLAN.md 1.6.4).
 *
 * There are two distinct latency costs here and only one of them is ours:
 *
 *   1. Neon compute cold start — a few hundred ms. Neon autosuspends after five
 *      minutes with no *active queries*; open idle connections do NOT keep it
 *      awake. No pool setting can prevent this, which is what `keepWarm` below
 *      is for.
 *   2. TCP + TLS handshake — paid whenever the pool holds no live socket. This
 *      is the part pool config actually fixes.
 *
 * History worth not repeating: commit 0c3cd4f set `min:1, idleTimeoutMillis:0,
 * keepAlive:true` for exactly this reason. Commit 78b7ccb then reverted all
 * three — almost certainly reacting to "connection terminated unexpectedly",
 * which was caused by holding sockets open forever *without* TCP keepalive
 * probes, so the network reaped them and `pg` handed out dead clients. Removing
 * `keepAlive` made that worse, not better. The fix is keepalive plus a bounded
 * idle timeout, not a short one.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10_000,
  // Bounded, but long enough that calls a minute or two apart reuse a socket.
  // Not 0 (sockets live forever and go stale) and not 10s (the pg default,
  // which is effectively always-cold for this workload).
  idleTimeoutMillis: 30_000,
  // TCP-level probes. This is what stops an idle socket being silently reaped
  // by NAT, a load balancer, or Neon itself.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  // Recycle connections so a single long-lived one cannot accumulate
  // server-side memory or outlive a Neon compute restart.
  maxUses: 7_500,
});

pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

export const db = drizzle(pool);

/**
 * Closes every pooled connection.
 *
 * The pool is created at module load and holds live sockets — `keepAlive` is on
 * and the idle timeout is 30s, both deliberately (see above). Those sockets are
 * libuv handles, so Node will not exit while they are open. Without this, the
 * API ignored SIGINT, sat there until tsx gave up after five seconds and
 * force-killed it, and `pnpm dev` took a beating on every Ctrl-C.
 */
export async function closeDb(): Promise<void> {
  await pool.end();
}

/**
 * Neon suspends the compute after ~5 minutes with no active queries, and calls
 * to a small business are minutes apart — so without this the first call after
 * a quiet spell pays a cold start before the greeting can play.
 *
 * This is deliberately an experiment, not a permanent fixture. If it removes the
 * pickup delay, the compute was sleeping and the honest next step is to decide
 * between disabling Neon's scale-to-zero and moving to a co-located always-on
 * Postgres — see PLAN.md 1.6.3, which states that exit condition. Keeping a
 * database awake by pinging it is a workaround for not having chosen yet.
 *
 * Started only by the agent worker. The API server does not need it: a cold
 * dashboard request costs a few hundred ms and nobody is listening to silence.
 */
const KEEP_WARM_INTERVAL_MS = 4 * 60 * 1000;

export function startDbKeepWarm(): NodeJS.Timeout {
  const timer = setInterval(() => {
    db.execute(sql`SELECT 1`).catch((err: unknown) => {
      console.error(
        "[db] keep-warm ping failed:",
        err instanceof Error ? err.message : err
      );
    });
  }, KEEP_WARM_INTERVAL_MS);

  // Never hold the process open on this timer alone.
  timer.unref();
  return timer;
}
