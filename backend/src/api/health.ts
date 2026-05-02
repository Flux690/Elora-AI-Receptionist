import express from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ ok: true, database: "connected" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, database: "disconnected", error: message });
  }
});

export default router;
