import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env.js";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  min: 1,
  idleTimeoutMillis: 0,
  keepAlive: true,
});

export const db = drizzle(pool);
