import { Hono } from "hono";
import { checkHealth } from "../controllers/health.js";

export default new Hono().get("/", checkHealth);
