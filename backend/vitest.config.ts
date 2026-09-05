import { defineConfig } from "vitest/config";

/**
 * Three projects, split by filename so cost and speed stay separable:
 *
 *   unit   *.test.ts       pure unit + FakeLLM agent tests. No DB, no network.
 *   int    *.int.test.ts   needs the Docker Postgres from docker-compose.yml.
 *   live   *.live.test.ts  needs real credentials and spends tokens.
 *
 * Select with `vitest --project unit`. See package.json scripts.
 *
 * Env lives here rather than in a .env.test file because .gitignore line 7 is
 * `.env.*`, so a .env.test would be ignored and nobody else's tests would run.
 * These are all dummy values; the only real one is DATABASE_URL, which points
 * at the throwaway container.
 */
const testEnv = {
  PORT: "8080",
  DATABASE_URL: "postgresql://deskroute:deskroute@localhost:5433/deskroute_test",
  LIVEKIT_URL: "wss://test.livekit.cloud",
  LIVEKIT_API_KEY: "test-key",
  LIVEKIT_API_SECRET: "test-secret",
  CLERK_SECRET_KEY: "sk_test_dummy",
  OPENROUTER_API_KEY: "test-key",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  LLM_MODEL: "anthropic/claude-haiku-4.5",
  SUMMARY_LLM_MODEL: "openai/gpt-4o-mini",
  R2_ACCOUNT_ID: "test-account",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET_NAME: "test-bucket",
};

const base = {
  globals: true,
  environment: "node" as const,
  env: testEnv,
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...base,
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts", "src/**/*.live.test.ts"],
          setupFiles: ["src/test/setup.unit.ts"],
        },
      },
      {
        test: {
          ...base,
          name: "int",
          include: ["src/**/*.int.test.ts"],
          setupFiles: ["src/test/setup.int.ts"],
          // Integration tests share one database. Running files in parallel
          // would let one file's truncate wipe another file's fixtures.
          fileParallelism: false,
        },
      },
      {
        test: {
          // Deliberately NOT `...base`, because `base` carries `testEnv`.
          //
          // Vitest writes `test.env` into process.env before any module loads,
          // and dotenv does not overwrite a variable that already exists — so a
          // live project spreading `base` would keep CLERK_SECRET_KEY at
          // "sk_test_dummy" and DATABASE_URL pointed at the Docker container,
          // and every "live" test would quietly be exercising a fake.
          //
          // setup.live.ts loads the real backend/.env and refuses to run if a
          // placeholder survived anyway.
          globals: true,
          environment: "node" as const,
          name: "live",
          include: ["src/**/*.live.test.ts"],
          setupFiles: ["src/test/setup.live.ts"],
          // Real network calls to Google and an LLM. Generous timeout, and no
          // parallelism: these touch shared external state.
          testTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
