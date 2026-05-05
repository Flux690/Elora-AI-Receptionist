# Elora AI Receptionist — Codebase Guide

## What this is

Elora is a telephony-first AI receptionist for appointment-based local businesses (salons, spas, clinics). Customers call a real phone number. LiveKit SIP routes the call to the Elora agent. The agent answers questions, escalates unknowns to a human admin, and books appointments via Google Calendar.

It is being built as a B2B SaaS portfolio project. The data model is multi-tenant from day one — every table has a `tenant_id`, and each paying business is one tenant.

## Workspace layout

```
/                        ← npm workspace root
├── backend/             ← Hono API server + LiveKit agent worker (TypeScript)
├── frontend/            ← Admin dashboard (React + Vite)
├── PRD-v2.md            ← Product requirements (source of truth for design decisions)
└── CLAUDE.md            ← this file
```

## How to run things

All commands from the workspace root unless noted.

```bash
# API server (hot reload)
npm run dev -w backend          # → http://localhost:8080

# LiveKit agent worker (separate process)
npm run agent -w backend        # registers as "receptionist" with LiveKit Cloud

# Production build
npm run build -w backend

# Database migrations
npm run db:generate -w backend  # generate migration from schema changes
npm run db:migrate -w backend   # apply migrations to Neon Postgres

# Frontend dev server
npm run dev -w frontend         # → http://localhost:5173
```

## Backend architecture

Two processes from one package:

1. **API server** (`src/index.ts`) — Hono, serves admin dashboard at `/api/admin/*`, health at `/api/health`
2. **Agent worker** (`src/agent/worker.ts`) — Long-running LiveKit agent process, one per deployment, handles all concurrent calls

### Key directories

```
backend/src/
├── agent/
│   ├── worker.ts        ← Full agent: defineAgent, Agent class, tool definitions
│   └── prompt.md        ← Base system prompt (business context injected at runtime)
├── controllers/         ← HTTP logic — parse input, call service, return response
│   ├── health.ts
│   ├── metrics.ts
│   ├── escalations.ts
│   ├── knowledge.ts
│   ├── calls.ts
│   ├── appointments.ts
│   └── settings.ts
├── db/
│   ├── client.ts        ← Drizzle + pg Pool, exported as `db`
│   └── schema.ts        ← All 8 table definitions + enums
├── middleware/
│   └── auth.ts          ← Clerk JWT verification + tenant resolution
├── routes/
│   ├── index.ts         ← Mounts /health + /admin
│   ├── health.ts
│   └── admin/
│       ├── index.ts     ← Applies auth middleware, mounts routes
│       └── routes.ts    ← All 9 admin route definitions
├── services/            ← All DB access — one file per domain
│   ├── tenants.ts
│   ├── clients.ts
│   ├── calls.ts
│   ├── escalations.ts
│   ├── knowledge.ts
│   ├── appointments.ts
│   ├── calendar.ts      ← Google Calendar free/busy + event creation (no googleapis package)
│   └── embeddings.ts
├── types.ts             ← AppEnv, AppContext shared Hono types
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

1. `clerkAuth` (`@hono/clerk-auth`) — verifies the Clerk JWT from the `Authorization: Bearer` header. Reads `CLERK_SECRET_KEY` from env automatically.
2. `requireTenant` — extracts `userId` from the verified token, looks up the tenant by `clerkUserId`, injects `tenantId` into Hono context.

If no valid token → 401. If no tenant found for that userId → 404.

### Linking a tenant to a Clerk user

On first sign-in the user gets a Clerk `userId`. Link it to the tenant manually in Neon until the onboarding flow is built:

```sql
UPDATE tenants SET clerk_user_id = 'user_xxxxxxxxx' WHERE phone_number = '14843040147';
```

### Environment variables for Clerk

| Variable | Where | Purpose |
|----------|-------|---------|
| `CLERK_SECRET_KEY` | `backend/.env` | JWT verification + Clerk API (OAuth token fetch in agent) — never expose |
| `VITE_CLERK_PUBLISHABLE_KEY` | `frontend/.env` | `<ClerkProvider>` — safe to expose |
| `VITE_CLERK_SIGN_IN_URL` | `frontend/.env` | Tells Clerk where sign-in page lives (needed for OAuth cancel recovery) |
| `VITE_CLERK_SIGN_UP_URL` | `frontend/.env` | Tells Clerk where sign-up page lives |
| `VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `frontend/.env` | Post-OAuth fallback redirect destination |
| `VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `frontend/.env` | Post-OAuth fallback redirect destination |

Note: `signInUrl`/`signUpUrl` are also set directly on `<ClerkProvider>` in `main.tsx` — props take precedence over env vars and are the authoritative source for Clerk's internal navigation.

### OAuth redirect pattern (Google Calendar)

`redirectUrl` passed to `reauthorize()`/`createExternalAccount()` includes `?returnTo=/appointments`. `SSOCallback` reads this param and passes it to `signInForceRedirectUrl` on `<AuthenticateWithRedirectCallback>`. Force redirect is used (not fallback) to ensure the destination is deterministic regardless of Clerk's session state.

## Agent worker patterns

### LiveKit components used

| Import | Purpose |
|--------|---------|
| `defineAgent` | Agent factory function |
| `voice.Agent` | Base class — `Agent extends voice.Agent` |
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

Tools are defined in the `Agent` constructor using `llm.tool()` with Zod schemas. All dependencies (`tenant`, `client`, `callId`) are closed over from the `entry` function — the LLM never receives tenant IDs.

```ts
tools: {
  searchKnowledge: llm.tool({ ... execute: async ({ query }) => ... }),
  createEscalation: llm.tool({ ... execute: async ({ question }, { ctx }) => ... }),
  checkAvailability: llm.tool({ ... execute: async ({ service, startIso, endIso }) => ... }),
  bookAppointment: llm.tool({ ... execute: async ({ service, startIso, endIso }) => ... }),
  endCall: llm.tool({ ... execute: async ({ reason }, { ctx }) => ... }),
}
```

### Entry function order

```
ctx.connect() → waitForParticipant() → resolve tenant → [resolveClientByPhone + upsertClient] → createCall
→ new Agent(deps) → session.start() → session.say(greeting)
```

**Why this deviates from the LiveKit docs canonical order (`session.start()` before `ctx.connect()`):**
We need `sip.trunkPhoneNumber` from participant attributes to resolve the tenant and construct `new Agent(deps)`. The participant only exists after `ctx.connect()` + `waitForParticipant()`. This is a necessary deviation — we cannot build `Agent` without knowing the tenant first.

### endCall tool pattern

```ts
execute: async ({ reason }, { ctx }) => {
  await finishCall(deps.callId, "answered");
  await ctx.session.generateReply({
    userInput: `You are about to end the call due to ${reason}, notify the user with one last message`,
  });
  ctx.session.shutdown({ reason });
},
```

`ctx.session.shutdown()` is the SDK-managed lifecycle method. Never use `RoomServiceClient.deleteRoom()`.

## LiveKit SIP architecture

### Dispatch rules

A dispatch rule is a routing object in LiveKit. Phone numbers point to a dispatch rule via `sip_dispatch_rule_id`. When a call comes in, LiveKit looks up the rule and dispatches a job to the agent worker.

**Current setup (one platform-wide rule):**
- One dispatch rule for all tenants
- All phone numbers point to this same rule
- The "inbound routing filter" on the rule must be **empty** — if you list specific numbers there, only those numbers route through it and new tenants break automatically
- Tenant is resolved at call time via `sip.trunkPhoneNumber` → `tenants.phone_number`

**One-rule-per-tenant alternative (for future onboarding flow):**
- Each tenant gets their own dispatch rule with `{"tenantId": "abc123"}` in dispatch metadata
- The agent reads `ctx.job.metadata` (available before `ctx.connect()`) to get the tenant ID
- Enables canonical `session.start()` → `ctx.connect()` order from docs
- Only worth doing when building the programmatic onboarding flow — at that point it's one extra API call at no real cost

**Dispatch metadata limitation:** Static JSON string baked into the rule at creation time. No templating. Only useful for per-tenant rules.

### Phone Numbers API

- Available via: HTTP Twirp API, Go SDK, LiveKit CLI
- **NOT available in `livekit-server-sdk` Node.js** — the Node SDK only has `SipClient.createSipDispatchRule()`
- Purchasing/assigning phone numbers from Node.js requires direct HTTP calls to the LiveKit Twirp API

### Programmatic tenant onboarding flow (future)

1. Create a LiveKit dispatch rule via `SipClient.createSipDispatchRule()`
2. Purchase/assign a phone number via LiveKit HTTP API with `sip_dispatch_rule_id` pointing to the rule
3. Insert a row into `tenants` with business details + `clerk_user_id`
4. Set `phone_number` on the tenant row

## Database schema

8 tables, all tenant-scoped. See [backend/src/db/schema.ts](backend/src/db/schema.ts).

Key design notes:
- `tenants.phone_number` — direct column (unique), no separate phone_numbers table
- `tenants.clerk_user_id` — links Clerk auth user to tenant; set manually until onboarding flow exists
- `tenants.google_calendar_id` — set when tenant connects Google Calendar integration
- `business_profile` on `tenants` is `jsonb` — structured business facts (hours, services, policies)
- `knowledge_chunks.embedding` is `vector(1536)` — if switching embedding models, verify dimension matches
- `escalation_status` enum values are lowercase: `"pending"` / `"resolved"`
- `knowledge_items` + `knowledge_chunks` are separate: items hold canonical Q&A, chunks hold embedded text for retrieval

## Multi-tenancy

- Every table has `tenant_id`. Every service function takes `tenantId` as the first argument.
- Agent resolves tenant from `sip.trunkPhoneNumber` → `tenants.phone_number` (direct lookup, no join).
- Admin API resolves tenant from Clerk JWT → `clerkUserId` → `tenants.clerk_user_id`.
- The LLM never receives or chooses tenant IDs. Backend code always injects them.

## Environment variables

| Variable | Used by |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `LIVEKIT_URL` | Agent worker |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Agent worker |
| `CLERK_SECRET_KEY` | Hono auth middleware + agent worker (Clerk API for OAuth token fetch) |
| `OPENROUTER_API_KEY` | LLM calls + embeddings |
| `OPENROUTER_BASE_URL` | Defaults to `https://openrouter.ai/api/v1` |
| `LLM_MODEL` | Defaults to `openai/gpt-oss-20b:free` |
| `EMBEDDING_MODEL` | Defaults to `nvidia/llama-nemotron-embed-vl-1b-v2:free` |

## Call performance

**DB calls per call (4 total, ~80–120ms combined):**
1. `resolveTenantByCalledNumber` — direct lookup on `tenants.phone_number`
2. `resolveClientByPhone` — looks up returning caller (runs in parallel with 3 and the token fetch)
3. `upsertClient` — inserts/updates caller record (runs in parallel with 2 and the token fetch)
4. `createCall` — creates call record

**Clerk API call (conditional, parallel with DB calls 2–3):**
- If `tenant.googleCalendarId` is set, `clerkClient.users.getUserOauthAccessToken()` is called in the same `Promise.all` — zero added latency on the hot path.

Business details baked into system prompt once at call start. Not re-fetched per turn.

**Latency profile to first audio:** ~1–1.5s
- LiveKit dispatch: ~150ms
- `ctx.connect()`: ~50ms
- All 4 DB calls combined: ~80–120ms
- TTS synthesis: ~500–800ms ← **dominant bottleneck**

## Phase status

- **Done**: SIP wiring, Neon/Drizzle schema, service layer, tool-based agent, LiveKit inbound trunk + dispatch rule, live call test, Hono migration, Clerk auth middleware, DB cleanup (phone_numbers table dropped, google fields cleaned), full admin dashboard (calls, escalations, appointments, knowledge, settings, overview), Google Calendar integration (OAuth connect flow, availability checking, appointment booking)
- **Later**: Programmatic tenant onboarding flow
