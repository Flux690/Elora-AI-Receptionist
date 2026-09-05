import type { Context } from "hono";

export type AppVariables = { tenantId: string };
export type AppEnv = { Variables: AppVariables };
export type AppContext = Context<AppEnv>;
