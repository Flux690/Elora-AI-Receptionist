import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import config from "../config.js";

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export const db = drizzle(pool);
