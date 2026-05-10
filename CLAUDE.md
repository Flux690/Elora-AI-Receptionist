# Elora AI Receptionist — Codebase Guide

## What this is

Elora is a telephony-first AI receptionist for appointment-based local businesses (salons, spas, clinics). Customers call a real phone number. LiveKit SIP routes the call to the Elora agent. The agent answers questions, escalates unknowns to a human admin, and books appointments via Google Calendar.

Built as a B2B SaaS portfolio project. Multi-tenant from day one — every table has a `tenant_id`.

## Workspace layout

```
/                        ← npm workspace root (package.json, package-lock.json)
├── shared/              ← Type contracts only — no build step, no runtime code
├── backend/             ← Hono API server + LiveKit agent worker (TypeScript)
├── frontend/            ← Admin dashboard (React + Vite)
└── CLAUDE.md            ← this file
```

### shared/ — type contracts

`shared/src/index.ts` exports domain types (`ServiceItem`, `AgentProfile`, `CallOutcome`, API response shapes, etc.) imported as `@receptionist/shared` in both backend and frontend. It has a `package.json` only to register the workspace name — no build step, no compiled output, types are consumed directly via the `exports` field pointing at the `.ts` source. TypeScript is hoisted from the root workspace; `shared/` has no `node_modules`.

## How to run things

All commands from the workspace root.

```bash
npm run dev:backend     # API server with hot reload → http://localhost:8080
npm run dev:agent       # LiveKit agent worker (separate process)
npm run dev:frontend    # Frontend dev server → http://localhost:5173

# Database migrations (from root)
npm run db:generate -w backend   # generate migration from schema changes
npm run db:migrate -w backend    # apply migrations to Neon Postgres
```

## Backend architecture

Two processes from one package:

1. **API server** (`src/index.ts`) — Hono, serves admin dashboard at `/api/admin/*`, health at `/api/health`
2. **Agent worker** (`src/agent/worker.ts`) — Long-running LiveKit agent process, handles all concurrent calls

### Directory structure

```
backend/src/
├── agent/
│   ├── worker.ts        ← Entry point: defineAgent, session setup, ReceptionistAgent class
│   ├── tools.ts         ← All LLM tool definitions (searchKnowledge, createEscalation, etc.)
│   ├── prompt.ts        ← buildSystemPrompt() — injects tenant/caller context at call time
│   ├── types.ts         ← AgentDeps, CallState
│   ├── summary.ts       ← Post-call summary generation
│   └── transcript.ts    ← Transcript extraction from session history
├── controllers/         ← HTTP logic — parse input, call service, return response
│   ├── account.ts
│   ├── appointments.ts
│   ├── calls.ts
│   ├── escalations.ts
│   ├── health.ts
│   ├── knowledge.ts
│   ├── metrics.ts
│   ├── onboarding.ts
│   ├── settings.ts
│   └── telephony.ts
├── db/
│   ├── client.ts        ← Drizzle + pg Pool, exported as `db`
│   └── schema.ts        ← All 6 table definitions + enums
├── middleware/
│   └── auth.ts          ← Clerk JWT verification + tenant resolution
├── routes/
│   ├── index.ts         ← Mounts /health, /onboarding, /admin
│   ├── health.ts
│   └── admin.ts         ← Applies auth middleware, all admin route definitions
├── services/            ← All DB access — one file per domain
│   ├── tenants.ts
│   ├── clients.ts
│   ├── calls.ts
│   ├── escalations.ts
│   ├── knowledge.ts
│   ├── appointments.ts
│   ├── calendar.ts      ← Google Calendar free/busy + event creation (raw fetch, no googleapis)
│   ├── telephony.ts     ← LiveKit phone number search/purchase/release via Twirp HTTP API
│   └── storage.ts       ← LiveKit Egress recording start/stop + presigned URL
├── types.ts             ← AppEnv, AppContext shared Hono types
├── schemas.ts           ← Zod request validation schemas
└── env.ts               ← Zod-validated env loader
```

### Layering rules

- **Routes** — path + method + handler reference only. No logic.
- **Controllers** — parse input, call service, return response. No try/catch — unexpected errors bubble to the global `onError` handler in `index.ts`.
- **Services** — all DB access. Called by controllers and the agent worker. Never touch `db` directly outside services except `controllers/metrics.ts` for aggregate queries.

### Hono context typing

`AppEnv` / `AppContext` from `src/types.ts` must be used on all admin routes and controllers so `c.get('tenantId')` is type-safe.

## Auth

### How it works

All `/api/admin/*` routes go through two middleware in sequence:

1. `clerkAuth` (`@hono/clerk-auth`) — verifies the Clerk JWT from the `Authorization: Bearer` header.
2. `requireTenant` — extracts `userId` from the verified token, looks up the tenant by `clerkUserId`, injects `tenantId` into Hono context.

If no valid token → 401. If no tenant found for that userId → 404.

### Linking a tenant to a Clerk user

On first sign-in the user gets a Clerk `userId`. Link it to the tenant manually in Neon until the onboarding flow is used:

```sql
UPDATE tenants SET clerk_user_id = 'user_xxxxxxxxx' WHERE phone_number = '+14843040147';
```

### Environment variables for Clerk

| Variable | Where | Purpose |
|----------|-------|---------|
| `CLERK_SECRET_KEY` | `backend/.env` | JWT verification + Clerk API (OAuth token fetch in agent) — never expose |
| `VITE_CLERK_PUBLISHABLE_KEY` | `frontend/.env` | `<ClerkProvider>` — safe to expose |
| `VITE_CLERK_SIGN_IN_URL` | `frontend/.env` | Tells Clerk where sign-in page lives |
| `VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `frontend/.env` | Post-OAuth fallback redirect destination |
| `VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `frontend/.env` | Post-OAuth fallback redirect destination |

`signInUrl`/`signUpUrl` are also set directly on `<ClerkProvider>` in `main.tsx` — props take precedence over env vars.

### OAuth redirect pattern (Google Calendar)

`redirectUrl` passed to `reauthorize()`/`createExternalAccount()` includes `?returnTo=/appointments`. `SSOCallback` reads this param and passes it to `signInForceRedirectUrl` on `<AuthenticateWithRedirectCallback>`. Force redirect is used (not fallback) to ensure deterministic destination regardless of Clerk session state.

## Agent worker patterns

### LiveKit components used

| Import | Purpose |
|--------|---------|
| `defineAgent` | Agent factory function |
| `voice.Agent` | Base class — `ReceptionistAgent extends voice.Agent` |
| `voice.AgentSession` | Manages STT → LLM → TTS pipeline |
| `llm.tool` | Tool definition with Zod schema |
| `inference.STT/TTS` | Model providers via LiveKit inference |
| `openai.LLM` | LLM via OpenRouter (openai-compatible) |
| `silero.VAD` | Voice activity detection (loaded in prewarm) |
| `livekit.turnDetector.MultilingualModel` | Turn detection |
| `ServerOptions` | Worker registration with `agentName: 'receptionist'` |
| `ParticipantKind` | Detect SIP vs WebRTC participant |

### SIP caller resolution

```ts
// Caller's phone number (who is calling)
participant.attributes["sip.phoneNumber"]

// Business's phone number (which number was dialed → tenant lookup)
participant.attributes["sip.trunkPhoneNumber"]
```

### Tool pattern

Tools are defined in `tools.ts` via `createAgentTools(deps)`. All dependencies (`tenant`, `client`, `callId`) are closed over — the LLM never receives tenant IDs.

```ts
tools: {
  searchKnowledge      // RAG lookup for questions not in system prompt context
  createEscalation     // Flag unanswerable question to admin
  checkAvailability    // Google Calendar free/busy check
  bookAppointment      // Create confirmed calendar event + DB appointment
  lookupAppointments   // Caller's upcoming appointments by phone
  cancelAppointment    // Cancel a confirmed appointment
  endCall              // Say farewell and shut down session
}
```

### Entry function order

```
ctx.connect() → waitForParticipant() → resolve tenant via sip.trunkPhoneNumber
→ upsertClient → createCall → session.start() → session.say(greeting)
```

**Why `ctx.connect()` comes first (deviates from LiveKit docs canonical order):** `sip.trunkPhoneNumber` is only available after `waitForParticipant()`. We need it to resolve the tenant before building `ReceptionistAgent(deps)`. Without the tenant, we can't build the system prompt or wire tools.

### Hold phrase pattern

`sayHold(ctx)` calls `ctx.session.say(holdPhrase)` at the start of any tool that needs time (searchKnowledge, checkAvailability, bookAppointment). This fires the instant the LLM decides to call the tool — the caller hears something immediately while the tool runs.

**Important:** with a slow LLM model, the preemptive TTS connection opens when the LLM starts generating but can time out before the first token arrives, resulting in no audio. Use a fast model (e.g. `openai/gpt-4o-mini`) — the free default is too slow for reliable voice delivery.

### endCall tool pattern

```ts
execute: async (_params, { ctx }) => {
  const farewell = deps.tenant.agentProfile.farewell;
  if (farewell) ctx.session.say(farewell);
  ctx.session.shutdown({ drain: true });
}
```

`ctx.session.shutdown({ drain: true })` is the SDK-managed lifecycle method. Never use `RoomServiceClient.deleteRoom()`.

## LiveKit SIP architecture

### Dispatch rules

One platform-wide dispatch rule handles all tenants. All LiveKit phone numbers point to this same rule. The "inbound routing filter" on the rule must be **empty** — listing specific numbers there breaks new tenants automatically. Tenant is resolved at call time via `sip.trunkPhoneNumber` → `tenants.phone_number`.

### Why not per-tenant dispatch rules

LiveKit Phone Numbers (native telephony) do not expose a trunk ID — there is no inbound SIP trunk to reference in `trunk_ids` when creating a dispatch rule. Per-tenant rules require third-party SIP trunks (Twilio, Telnyx) where each number is a trunk with an ID. Since we use LiveKit's own numbers, the universal rule + runtime tenant lookup is the correct architecture.

### Phone Numbers API

- Available via: HTTP Twirp API, Go SDK, LiveKit CLI
- **NOT available in `livekit-server-sdk` Node.js** — the Node SDK only has `SipClient.createSipDispatchRule()`
- Purchasing/releasing numbers from Node.js uses direct HTTP calls to the LiveKit Twirp API (`services/telephony.ts`)

## Database schema

6 tables, all tenant-scoped. See [backend/src/db/schema.ts](backend/src/db/schema.ts).

| Table | Purpose |
|-------|---------|
| `tenants` | One row per business. Holds `services` and `agentProfile` as JSONB. |
| `clients` | Callers — resolved by phone number, upserted on each call. |
| `calls` | One row per inbound call. Stores transcript, summary, outcome. |
| `escalations` | Questions the agent couldn't answer, flagged for admin review. |
| `knowledge_items` | Q&A entries with vector embeddings for semantic retrieval. |
| `appointments` | Bookings — confirmed (Google Calendar event) or requested (no calendar). |

Key design notes:
- `tenants.services` is `jsonb` typed as `ServiceItem[]` — prices and descriptions live here, injected into the system prompt on every call
- `tenants.agentProfile` is `jsonb` typed as `AgentProfile` — greeting, farewell, fallback, holdPhrase, agent name
- `knowledge_items.embedding` is `vector(2048)` — match this dimension when changing embedding models
- Embeddings are stored directly on `knowledge_items` (no separate chunks table)
- `escalation_status` enum values are lowercase: `"pending"` / `"resolved"`

## Multi-tenancy

- Every table has `tenant_id`. Every service function takes `tenantId` as the first argument.
- Agent resolves tenant from `sip.trunkPhoneNumber` → `tenants.phone_number` (direct lookup, no join).
- Admin API resolves tenant from Clerk JWT → `clerkUserId` → `tenants.clerk_user_id`.
- The LLM never receives or chooses tenant IDs. Backend code always injects them.

## Environment variables

| Variable | Used by |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `LIVEKIT_URL` | Agent worker + telephony service |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Agent worker + telephony service |
| `CLERK_SECRET_KEY` | Hono auth middleware + agent worker |
| `CLERK_WEBHOOK_SECRET` | (unused — webhook route removed) |
| `OPENROUTER_API_KEY` | LLM calls + embeddings |
| `OPENROUTER_BASE_URL` | Defaults to `https://openrouter.ai/api/v1` |
| `LLM_MODEL` | Defaults to `openai/gpt-oss-20b:free` — use `openai/gpt-4o-mini` for production |
| `EMBEDDING_MODEL` | Defaults to `nvidia/llama-nemotron-embed-vl-1b-v2:free` |

## Call performance

**DB calls per call (3+1, ~80–120ms combined):**
1. `getTenantByPhoneNumber` — direct lookup on `tenants.phone_number`
2. `upsertClient` — inserts/updates caller record
3. `createCall` — creates call record
+ Conditional Clerk API call for Google OAuth token (parallel, zero added latency)

Business context baked into system prompt once at call start. Not re-fetched per turn.

**Latency to first audio (with a fast LLM):** ~1–1.5s
- LiveKit dispatch: ~150ms
- `ctx.connect()` + DB calls: ~130–170ms
- TTS synthesis: ~500–800ms ← dominant bottleneck

**With a slow/free LLM:** preemptive TTS opens a WebSocket connection that times out before the first token arrives. The agent generates the correct text but **no audio plays**. Use a paid model for reliable voice delivery.

## Phase status

- **Done**: SIP wiring, Neon/Drizzle schema, service layer, tool-based agent, LiveKit inbound dispatch rule, live call test, Clerk auth middleware, full admin dashboard, Google Calendar integration, onboarding flow (create tenant + purchase phone number in one step), agent modularization (tools/prompt/summary/transcript split out), dead code removal (sipDispatchRuleId, per-tenant dispatch rules, tts-cache, webhooks stub)
- **Later**: Programmatic onboarding UI polish, outbound calling (LiveKit roadmap)
