import type { Context } from "hono";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

export async function checkHealth(c: Context) {
  await db.execute(sql`SELECT 1`);
  return c.json({ status: "ok" });
}
