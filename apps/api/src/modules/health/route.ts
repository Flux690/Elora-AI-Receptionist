import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "@receptionist/core/db/client.js";

export const health = new Hono().get("/", async (c) => {
  await db.execute(sql`SELECT 1`);
  return c.json({ status: "ok" });
});
