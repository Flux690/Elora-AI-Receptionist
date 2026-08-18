import { describe, it, expect } from "vitest";
import { createApp } from "./app.js";

/**
 * PLAN.md 1.8.5 — CORS was `app.use("*", cors())` with no options, which sends
 * `access-control-allow-origin: *` to any origin that asks, on every route
 * including `/api/admin/*`.
 *
 * Bearer-token auth means a wildcard origin is not the credential-leak it would
 * be with cookies, but it does let any page on the internet drive the admin API
 * with a token it has obtained, and there is no reason to allow it.
 */
describe("CORS", () => {
  const DASHBOARD = "http://localhost:5173";
  const app = createApp({ allowedOrigins: [DASHBOARD] });

  it("allows the dashboard origin", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: DASHBOARD },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(DASHBOARD);
  });

  it("does not send a wildcard to an unknown origin", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: "https://evil.example" },
    });
    const allowed = res.headers.get("access-control-allow-origin");
    expect(allowed).not.toBe("*");
    expect(allowed).not.toBe("https://evil.example");
  });

  it("does not send a wildcard on preflight for admin routes", async () => {
    const res = await app.request("/api/admin/settings", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "PATCH",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).not.toBe("*");
  });
});
