import type { Context } from "hono";

export type AppVariables = { agentId: string };
export type AppEnv = { Variables: AppVariables };
export type AppContext = Context<AppEnv>;
