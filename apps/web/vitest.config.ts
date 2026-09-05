import { defineConfig } from "vitest/config";

/**
 * The frontend had no test runner. This one exists for the design-token
 * contract, which reads `src/index.css` off disk and resolves it — so the
 * environment is node, not jsdom: there is no DOM to consult and a browser
 * would report `oklch()` back verbatim anyway.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
