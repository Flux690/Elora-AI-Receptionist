# DeskRoute — Codebase Guide

## What this is

Telephony-first AI receptionist for appointment-based local businesses. Customers call a real phone number → LiveKit SIP → AI agent (answers, escalates, books) → admin dashboard.

Multi-tenant B2B SaaS. Every DB table has `tenant_id`. Every service function takes `tenantId` as the first argument.

## Commands

```bash
npm run dev:backend     # API server → http://localhost:8080
npm run dev:agent       # LiveKit agent worker (separate process, keep alongside API)
npm run dev:frontend    # Admin dashboard → http://localhost:5173

npm run db:generate -w backend   # generate migration from schema changes
npm run db:migrate -w backend    # apply to Neon Postgres
```

## Architecture

Two processes from `backend/`:

1. **API server** (`src/index.ts`) — Hono, serves `/api/admin/*`, `/api/health`, `/api/onboarding`
2. **Agent worker** (`src/agent/worker.ts`) — long-running LiveKit process, handles all concurrent calls

`shared/src/index.ts` exports domain types as `@receptionist/shared`. No build step — consumed directly from `.ts` source via the `exports` field. TypeScript is hoisted to root; `shared/` has no `node_modules`.

## Layering rules

- **Routes** — path + method + handler reference only. No logic.
- **Controllers** — parse input, call service, return response. No try/catch — errors bubble to global `onError` in `index.ts`.
- **Services** — all DB access. Exception: `controllers/metrics.ts` uses `db` directly for aggregate queries.
- Use `AppEnv` / `AppContext` from `src/types.ts` on all admin routes and controllers so `c.get('tenantId')` is type-safe.

## Auth

All `/api/admin/*` routes go through two middleware in sequence:
1. `clerkAuth` (`@hono/clerk-auth`) — verifies Clerk JWT from `Authorization: Bearer`
2. `requireTenant` — extracts `userId`, looks up tenant by `clerkUserId`, injects `tenantId` into Hono context

Clerk redirect env vars are NOT used — `signInUrl`, `signUpUrl`, `afterSignOutUrl` are hardcoded as props on `<ClerkProvider>` in `main.tsx`.

Google Calendar OAuth: `redirectUrl` includes `?returnTo=/appointments`. `SSOCallback` reads this param and passes it to `signInForceRedirectUrl` (force redirect, not fallback — ensures deterministic destination regardless of Clerk session state).

## Agent worker — non-obvious patterns

### Why `ctx.connect()` comes before everything

`sip.trunkPhoneNumber` (the dialed number, used for tenant lookup) is only available after `waitForParticipant()`. We must connect first to get the participant, then resolve the tenant before building `ReceptionistAgent(deps)`.

```
ctx.connect() → waitForParticipant() → getTenantByPhoneNumber(trunkPhone)
→ upsertClient → createCall → session.start() → session.say(greeting)
```

SIP attribute names:
- `participant.attributes["sip.phoneNumber"]` — caller's number (who is calling)
- `participant.attributes["sip.trunkPhoneNumber"]` — number that was dialed (tenant lookup key)

### Tools

`createAgentTools(deps)` closes over `tenant`, `client`, `callId`. The LLM never receives or chooses tenant IDs — backend code always injects them.

Hold phrase: call `ctx.session.say(holdPhrase)` at the start of any slow tool. Fires the instant the LLM decides to invoke the tool, so the caller hears something immediately while it runs.

`endCall`: use `ctx.session.shutdown({ drain: true })`. Never `RoomServiceClient.deleteRoom()`.

### LLM model matters for voice

With a slow LLM (>5s to first token), preemptive TTS opens a WebSocket that times out before the first token arrives — the agent produces correct text but **no audio plays**. Use `openai/gpt-4o-mini` or faster. The free default is not viable for voice delivery.

## LiveKit SIP — single dispatch rule

One platform-wide dispatch rule handles all tenants. The inbound routing filter must be **empty** — listing specific numbers there breaks new tenants. Tenant is resolved at runtime via `sip.trunkPhoneNumber` → `tenants.phone_number`.

LiveKit Phone Numbers have no inbound trunk ID, making per-tenant dispatch rules (which require `trunk_ids`) impossible with native numbers. Universal rule + runtime lookup is the correct architecture for LiveKit-hosted telephony.

The Phone Numbers API is **not in `livekit-server-sdk` (Node.js)** — purchasing and releasing numbers uses direct HTTP calls to the LiveKit Twirp API in `services/telephony.ts`.

**Releasing a number**: LiveKit auto-associates every purchased number with the project's dispatch rule. Call `UpdatePhoneNumber` with `sip_dispatch_rule_id: ""` first to dissociate — skipping this returns a 400 ("would become a catch-all dispatch rule"). Field name is `phone_number` (singular string), not `phone_numbers`.

## Database — key notes

- `tenants.services` — `jsonb` typed as `ServiceItem[]`; injected into system prompt on every call
- `tenants.agentProfile` — `jsonb` typed as `AgentProfile`; holds greeting, farewell, fallback, holdPhrase, name
- `knowledge_items.embedding` — `vector(2048)`; match this dimension when changing embedding models
- Embeddings stored directly on `knowledge_items` — no separate chunks table
- Escalation status enum values are lowercase: `"pending"` / `"resolved"`
