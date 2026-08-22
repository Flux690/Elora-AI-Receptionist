# DeskRoute - Codebase Guide

## What this is

Telephony-first AI receptionist for appointment-based local businesses. Customers call a real phone number → LiveKit SIP → AI agent (answers, escalates, books) → admin dashboard.

Multi-tenant B2B SaaS. Every DB table has `tenant_id`. Every service function takes `tenantId` as the first argument.

## Versioning

`major.minor.patch`, and **only the root `package.json` carries it**. The three
workspaces are `private: true` and have no `version` field at all — nothing is
published, so a version on them is a number nobody reads and three more places to
forget. `workspace:*` resolves by name, not by version, so removing them changes
nothing about how the packages link.

The line starts at **1.0.0**. From here every ordinary change is a **patch** bump
— 1.0.1, 1.0.2 — and that includes features and fixes alike. Reserve `minor` for
a release you would actually describe to a customer as new capability, and
`major` for a break in the API contract or the database shape that needs a
migration somebody has to think about.

Bump in the same commit as the work. A version that lands in its own commit tells
you nothing about what changed.

## Commands

```bash
pnpm dev             # all three below at once, via concurrently (api, agent, ui)

pnpm dev:backend     # API server → http://localhost:8080
pnpm dev:agent       # LiveKit agent worker (separate process, keep alongside API)
pnpm dev:frontend    # Admin dashboard → http://localhost:5173

pnpm -F backend db:generate   # generate migration from schema changes
pnpm -F backend db:migrate    # apply to Neon Postgres

pnpm typecheck       # tsc --noEmit across shared, backend, frontend
pnpm build           # build frontend
pnpm lint            # lint frontend

docker compose up -d          # throwaway Postgres for tests, host port 5433
pnpm -F backend test          # unit + agent tests (no DB, no network)
pnpm -F backend test:int      # service tests against the Docker Postgres
pnpm -F backend test:live     # real-LLM tests; costs tokens, excluded from CI
```

Tests are three vitest projects split by filename: `*.test.ts` (unit),
`*.int.test.ts` (needs Docker), `*.live.test.ts` (needs real credentials).
Test env lives in `backend/vitest.config.ts`, not a `.env.test` — `.gitignore`
would swallow the latter. `test:int` pins the test `DATABASE_URL` inline so it
can never reach production Neon.

## Architecture

Two processes from `backend/`:

1. **API server** (`src/index.ts`) - Hono, serves `/api/admin/*`, `/api/health`, `/api/onboarding`
2. **Agent worker** (`src/agent/worker.ts`) - long-running LiveKit process, handles all concurrent calls

`shared/src/index.ts` exports domain types as `@receptionist/shared`. No build step - consumed directly from `.ts` source via the `exports` field. Each workspace has its own `node_modules`; `shared/` has only `typescript` as a devDependency.

`src/llm.ts` exports a single `openrouter` client (OpenAI SDK pointed at OpenRouter's base URL). It is now used **only for embeddings** - do not instantiate `new OpenAI(...)` elsewhere.

Chat models go through `buildLLM()` in `src/agent/session-config.ts`, shared by the in-call session and the post-call summariser so the two cannot drift. `LLM_PROVIDER` selects the gateway:

- `livekit` (default) - LiveKit Inference, the same gateway as STT and TTS, so one less network hop and server-side failover. Metered against the plan's included allowance, which is a **hard cap** on the free Build plan.
- `openrouter` - wider model choice, but **requires credits on the account**. With none, OpenRouter yields an empty stream and no exception, so the agent answers the greeting and then silently says nothing.

`LLM_MODEL` / `SUMMARY_LLM_MODEL` must use the id format of whichever gateway is selected.

## Layering rules

- **Routes** - path + method + handler reference only. No logic.
- **Controllers** - parse input, call service, return response. No try/catch - errors bubble to global `onError` in `index.ts`. Sole exception: `onboarding`/`telephony` wrap phone-number provisioning to release the purchased number on a later failure, then re-throw (so the error still bubbles).
- **Services** - all DB access. Exception: `controllers/metrics.ts` uses `db` directly for aggregate queries.
- Use `AppEnv` / `AppContext` from `src/types.ts` on all admin routes and controllers so `c.get('tenantId')` is type-safe.

## Auth

All `/api/admin/*` routes go through two middleware in sequence:
1. `clerkAuth` (`@hono/clerk-auth`) - verifies Clerk JWT from `Authorization: Bearer`
2. `requireTenant` - extracts `userId`, looks up tenant by `clerkUserId`, injects `tenantId` into Hono context

Clerk redirect env vars are NOT used - `signInUrl`, `signUpUrl`, `afterSignOutUrl` are hardcoded as props on `<ClerkProvider>` in `main.tsx`.

Google Calendar OAuth: `redirectUrl` includes `?returnTo=/appointments`. `SSOCallback` reads this param and passes it to `signInForceRedirectUrl` (force redirect, not fallback - ensures deterministic destination regardless of Clerk session state).

## Agent worker - non-obvious patterns

### Why `ctx.connect()` comes before everything

`sip.trunkPhoneNumber` (the dialed number, used for tenant lookup) is only available after `waitForParticipant()`. We must connect first to get the participant, then resolve the tenant before building `ReceptionistAgent(deps)`.

```
ctx.connect() → waitForParticipant() → resolveTenant (trunkPhone, or tenantId for test)
→ session.start() → session.say(greeting)
→ [background, after greeting fires] startCallRecording + upsertClient + createCall
```

DB writes and recording are deliberately deferred until after the greeting plays - they're off the critical path so the caller hears audio with zero blocking DB roundtrips.

SIP attribute names:
- `participant.attributes["sip.phoneNumber"]` - caller's number (who is calling)
- `participant.attributes["sip.trunkPhoneNumber"]` - number that was dialed (tenant lookup key)

### Test sessions (browser)

The worker serves two participant types. Real SIP calls resolve the tenant from `sip.trunkPhoneNumber`. **Browser test sessions** (`POST /api/admin/agent/test`) carry `testSession: "true"` and `tenantId` in participant attributes - the worker branches on `testSession`, resolves the tenant by ID, and **skips recording and all DB writes** (no call/client rows, no egress). Test rooms use explicit agent dispatch via the join token's `RoomConfiguration` (`RoomAgentDispatch`), not the universal SIP dispatch rule.

Frontend uses the LiveKit Session API (`useSession` + `SessionProvider` from `@livekit/components-react`), not `LiveKitRoom`. The session lifecycle effect must be StrictMode-safe - defer `session.end()` so a throwaway dev unmount doesn't kill the live connection.

Tenant lookups in the worker are cached per-key (id or phone) with a 5-minute TTL so config changes propagate without a restart. OAuth tokens for Google Calendar are cached for 50 minutes (tokens are valid 60 min), max 200 entries.

### Voice pipeline - configured by omission

`buildSessionConfig()` in `src/agent/session-config.ts` builds the session as a pure function, so the pipeline is assertable without booting a worker.

**Leave `turnHandling.turnDetection` undefined.** That makes the SDK auto-provision the audio `inference.TurnDetector` *and*, because it is a streaming detector, drop the endpointing floor from 500/3000ms to 300/2500ms. Setting anything there - including the old `livekit.turnDetector.MultilingualModel()` - forfeits both. Confirmed at runtime by `initializing inference runner: lk_eot_audio`.

**Telephony noise cancellation is SIP-only.** `TelephonyBackgroundVoiceCancellation()` is tuned for 8kHz phone audio; browser test sessions come from a laptop mic and must not get it. It runs *before* VAD, STT and turn detection, so it is a turn-detection accuracy fix rather than an audio nicety.

Service and business names are fed to STT as keyterms via `keytermsOptions` - the vocabulary a streaming recogniser mangles most.

### Booking - the model never touches a timestamp

`agent/scheduling.ts` is pure: no DB, no network, and `now` is passed in, so every
rule is testable without booting a worker.

- `zonedWallClockToUtc` - two-pass `Intl` offset correction, no dependency. Temporal is not stable in Node 22, and this is all a date library would be doing here.
- `generateCandidateSlots` - walks opening hours, steps a 15-minute grid, and keeps a slot only if `bufferBefore + duration + bufferAfter` fits **inside** the opening period. So a 30-minute service with 10 minutes of setup cannot start at 9:00 in a shop that opens at 9:00; the earliest is 9:10. Offering 9:00 promises a start nobody can keep.
- `filterByBusy` - compares the **padded block** against freeBusy, so cleanup after the previous job counts as a conflict.
- `findService` - matches what a caller actually says to a configured service, and returns null rather than guessing between two candidates.

`services/calendar.ts` only *fetches* now. It used to generate slots as well —
fixed 60-minute steps from an arbitrary start — which is how a caller could be
offered 3 a.m. Google can only tell us what is taken.

The tools take an intent and hand back opaque handles:

```
checkAvailability(service, preferredDate?, partOfDay?) -> { slots: [{ slotId, time }], note? }
bookAppointment(slotId)
```

Slot handles live in a per-call `Map` on `AgentDeps` and die with the call.
`bookAppointment` **re-checks freeBusy immediately before writing** — the slot was
computed while the caller was still deciding. Calendar events span the padded
block, not the appointment, or freeBusy reports the buffers free.

### AI disclosure

`agent/disclosure.ts` holds a platform-owned constant played **before** the
tenant's greeting, on real calls and browser test sessions alike. Not a column,
not editable: California AB 2905 / SB 243 carry $500 per call and the platform,
not the tenant, built the omission. `calls.disclosure_version` records which
wording played.

### Tools

`createAgentTools(deps)` closes over `tenant`, `services`, `client`, `callId`. The LLM never receives or chooses tenant IDs - backend code always injects them.

Hold phrase: call `ctx.session.say(holdPhrase)` at the start of any slow tool. Fires the instant the LLM decides to invoke the tool, so the caller hears something immediately while it runs.

`endCall`: use `ctx.session.shutdown({ drain: true })`. Never `RoomServiceClient.deleteRoom()`.

### LLM model matters for voice

With a slow LLM (>5s to first token), preemptive TTS opens a WebSocket that times out before the first token arrives - the agent produces correct text but **no audio plays**.

Measured time to first token through LiveKit Inference (3 samples, from India): `openai/gpt-4o-mini` 935/1616/822ms, `google/gemini-3.5-flash` 1628/1859/1268ms. Never assume - `MetricsCollected` is wired, so `grep '\[metrics\]'` in the worker log gives real p50/p95 per call.

Note the greeting is **not** affected by model choice: `session.say()` sends a fixed string straight to TTS and never touches the LLM. Model choice only changes the pause *after* the caller speaks.

## Frontend - non-obvious patterns

**The product is light-only and `dark:` is bound to a class that never appears.**
`@custom-variant dark (&:where(.dark, .dark *))` in `index.css`. Tailwind's default
`dark:` keys on `prefers-color-scheme`, so every `dark:` utility the shadcn
components ship was silently winning for anyone whose OS is in dark mode — which
is why inputs rendered as a translucent grey instead of taking the card fill.

**Controls use the control ladder, not the surface tokens.** `--control` /
`--control-hover` / `--control-active`. A control rests *above* the stage and
sinks *below* it when pressed. `Button` previously rested on `--background` — the
ground, the darkest surface — and lightened on hover, which is the movement
inverted.

**Settings sections come in two shapes.** `Section` defaults to `stacked`; pass
`layout="gutter"` only where the right-hand side is a repeating structure tall
enough that a heading above it would scroll away — opening hours, holidays,
services, the call phrases. A two-field section does not need the architecture of
a seven-row one.

**No rules between settings sections, and none between rows in a collection.**
Space groups them. The only line on a settings page is the tab underline.

**The API closes on a signal.** `index.ts` handles SIGINT and SIGTERM, closes the
HTTP server and ends the pg pool. Without it Node had no handler and two live
handles — the listener and the pool's kept-warm sockets — so Ctrl-C did nothing
and `tsx` force-killed after five seconds, leaving port 8080 occupied.

## LiveKit SIP - single dispatch rule

One platform-wide dispatch rule handles all tenants. The inbound routing filter must be **empty** - listing specific numbers there breaks new tenants. Tenant is resolved at runtime via `sip.trunkPhoneNumber` → `tenants.phone_number`.

LiveKit Phone Numbers have no inbound trunk ID, making per-tenant dispatch rules impossible with native numbers. Universal rule + runtime lookup is the correct architecture for LiveKit-hosted telephony.

**This was tried and reverted - do not retry it.** The deleted code is at `d52d3b0^:backend/src/services/telephony.ts`. It called `createSipDispatchRule` with **no `trunkIds`**, and the docs state that omitting `trunk_ids` makes a rule match *all* inbound trunks. So every per-tenant rule was a wildcard: the first worked, the second collided, and every new tenant failed with a catch-all error.

There is no way to scope it either. A dispatch rule's `inbound_numbers` filters the **caller's** number (an allowlist of who may call), not the dialed number. The dialed-number filter lives on the **trunk** - and LiveKit-hosted numbers expose no trunk to reference.

**Still true after Twilio.** Owning a trunk makes per-tenant rules technically possible, but the platform runs one trunk, not one per tenant. It would buy a single cached DB lookup at the cost of two LiveKit objects per customer to keep in sync.

The Phone Numbers API is **not in `livekit-server-sdk` (Node.js)** - purchasing and releasing numbers uses direct HTTP calls to the LiveKit Twirp API in `services/telephony.ts`.

**Releasing a number**: LiveKit auto-associates every purchased number with the project's dispatch rule. Call `UpdatePhoneNumber` with `sip_dispatch_rule_id: ""` first to dissociate - skipping this returns a 400 ("would become a catch-all dispatch rule"). Field name is `phone_number` (singular string), not `phone_numbers`.

## Database - key notes

- `services` - its own **table**, not a jsonb column. `duration_minutes`, `buffer_before_minutes`, `buffer_after_minutes`, `required_resources` (jsonb `string[]`, plural from day one and always empty today), `position`. Promoted out of `tenants.services` because a booking needs a permanent id to point at — in a blob a service is a list position, so a rename orphaned every past appointment
- `appointments.service_id` - FK to `services`, `ON DELETE SET NULL`, alongside the existing `service` text which keeps the name as it stood at booking time. A deleted or renamed service must not erase what somebody booked
- `tenants.business_hours` - `jsonb` typed as `BusinessHours`: `weekly` (multiple intervals per weekday; `[]` means closed) plus date `exceptions` that replace the weekly pattern outright. **Local wall-clock strings plus `tenants.timezone`, never UTC** — "we open at 9" has to survive daylight saving
- `tenants.booking_policy` - `jsonb` typed as `BookingPolicy`: `minNoticeMinutes` (default 30) and `maxAdvanceDays` (default 60)
- `tenants.calendar_provider` / `calendar_external_id` / `calendar_payload` - the scheduling adapter, replacing `google_calendar_id`. `appointments.external_event_id` replaces `google_event_id`. The provider lives on the tenant, so it is not repeated per row
- `calls.disclosure_version` - which AI-disclosure wording that caller heard. The audit trail for a per-call penalty regime
- `tenants.agentProfile` - `jsonb` typed as `AgentProfile`; holds greeting, farewell, fallback, holdPhrase, name
- `knowledge_items.embedding` - `vector(1536)`; must match `EMBEDDING_DIMENSIONS` env var and the embedding model's actual output dimension
- Embeddings stored directly on `knowledge_items` - no separate chunks table; HNSW index (m=16, ef_construction=64, cosine ops)
- **The embedding is best-effort.** `resolveEscalationWithKnowledge` used to throw when it could not be computed, which made an unread column a hard dependency of the product's core loop — an empty OpenRouter balance took answering escalations offline with a 500 and lost the answer the owner had typed. It now warns and saves with a null embedding. Vector search will not match those rows until they are re-embedded, which is a batch job for whenever Tier 2 is switched on
- **The knowledge base is inlined into the system prompt at call start, not retrieved.** There is no `searchKnowledge` tool - it cost two extra LLM round trips plus an embedding call and a vector query per question. `listKnowledgeForPrompt()` is the read; `searchKnowledge()` still exists but is unused, kept as the Tier 2 path for when the base exceeds ~300 items (at which point the lookup moves to an on-turn hook, **not** back into a tool)
- `caller_phone` is **nullable** on `calls`, `escalations` and `appointments`. A withheld caller ID means no identity - never a placeholder string. See `agent/caller.ts`
- Escalation status enum values are lowercase: `"pending"` / `"resolved"`
- Escalation dedup index: `(callId, lower(question))` where `callId IS NOT NULL` - prevents the same question being escalated twice in one call
- Recordings stored in Cloudflare R2 as `recordings/{callId}.ogg`
