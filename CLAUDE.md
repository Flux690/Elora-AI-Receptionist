# Elora AI Receptionist — Codebase Guide

## What this is

Elora is a telephony-first AI receptionist for appointment-based local businesses (salons, spas, clinics). Customers call a real phone number. LiveKit SIP routes the call to the Elora agent. The agent answers questions, escalates unknowns to a human admin, and will eventually book appointments via Google Calendar.

It is being built as a B2B SaaS portfolio project. The data model is multi-tenant from day one — every table has a `tenant_id`, and each paying business is one tenant.

## Workspace layout

```
/                        ← npm workspace root
├── backend/             ← Express API server + LiveKit agent worker (TypeScript)
├── frontend/            ← Admin dashboard (React, currently JSX — migration pending)
├── PRD-v2.md            ← Product requirements (source of truth for design decisions)
├── IMPLEMENTATION_PHASES.md  ← Phase log: what's done, what's next
└── CLAUDE.md            ← this file
```

## How to run things

All commands from the workspace root unless noted.

```bash
# API server (hot reload)
npm run dev -w backend          # → http://localhost:8080

# LiveKit agent worker (separate process)
npm run agent -w backend        # registers as "elora-receptionist" with LiveKit Cloud

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

1. **API server** (`src/index.ts`) — Express, serves admin dashboard at `/api/admin/*`, health at `/api/health`
2. **Agent worker** (`src/agent/worker.ts`) — Long-running LiveKit agent process, one per deployment, handles all concurrent calls

### Key directories

```
backend/src/
├── agent/
│   └── worker.ts        ← Full agent: defineAgent, EloraAgent class, tool definitions
├── api/
│   ├── index.ts         ← Mounts /admin and /health routers
│   └── health.ts        ← GET /api/health — DB connectivity check
├── db/
│   ├── client.ts        ← Drizzle + pg Pool, exported as `db`
│   └── schema.ts        ← All 8 table definitions + enums
├── routes/
│   └── admin.ts         ← All /api/admin/* endpoints
├── services/            ← All DB access — one file per domain
│   ├── tenants.ts
│   ├── clients.ts
│   ├── calls.ts
│   ├── escalations.ts
│   ├── knowledge.ts
│   └── embeddings.ts
└── config.ts            ← Typed env var loader
```

### Service layer rules

All database access goes through `src/services/`. Routes and the agent worker call services — they never touch `db` directly except in `routes/admin.ts` for simple aggregate queries. Services take explicit typed inputs and return typed rows from `schema.$inferSelect`.

## Agent worker patterns

### LiveKit components used

| Import | Purpose |
|--------|---------|
| `defineAgent` | Agent factory function |
| `voice.Agent` | Base class — `EloraAgent extends voice.Agent` |
| `voice.AgentSession` | Manages STT → LLM → TTS pipeline |
| `llm.tool` | Tool definition with Zod schema |
| `inference.STT/LLM/TTS` | Model providers via LiveKit inference |
| `silero.VAD` | Voice activity detection (loaded in prewarm) |
| `livekit.turnDetector.MultilingualModel` | Turn detection |
| `ServerOptions` | Worker registration with `agentName: 'elora-receptionist'` |
| `ParticipantKind` | Detect SIP vs WebRTC participant |

### SIP caller resolution

```ts
// Caller's phone number (who is calling)
participant.attributes["sip.phoneNumber"]

// Business's phone number (which number was dialed → tenant lookup)
participant.attributes["sip.trunkPhoneNumber"]
```

### Tool pattern

Tools are defined in the `EloraAgent` constructor using `llm.tool()` with Zod schemas. All dependencies (`tenant`, `client`, `callId`, `roomServiceClient`, etc.) are closed over from the `entry` function — the LLM never receives tenant IDs.

```ts
tools: {
  searchKnowledge: llm.tool({ ... execute: async ({ query }) => ... }),
  createEscalation: llm.tool({ ... execute: async ({ question }, { speechHandle }) => ... }),
  endCall: llm.tool({ ... execute: async () => ... }),
}
```

### Entry function order

```
waitForParticipant → resolve tenant → upsertClient → createCall
→ session.start() → ctx.connect() → session.say(greeting)
```

`session.start()` before `ctx.connect()` is intentional — this is the current LiveKit Agents v1 pattern.

## Database schema

8 tables, all tenant-scoped. See `backend/src/db/schema.ts`.

Key design notes:
- `business_profile` on `tenants` is `jsonb` — structured business facts (hours, services, policies)
- `knowledge_chunks.embedding` is `vector(1536)` via custom Drizzle type — matches OpenAI `text-embedding-3-small`
- `escalation_status` enum values are lowercase: `"pending"` / `"resolved"`
- `knowledge_items` + `knowledge_chunks` are separate: items hold canonical Q&A, chunks hold the embedded text for retrieval

## Multi-tenancy

- Every table has `tenant_id`. Every service function takes `tenantId` as the first argument.
- The agent resolves tenant from `sip.trunkPhoneNumber` → `phone_numbers` → `tenants` join.
- Admin routes currently use `DEFAULT_TENANT_ID` stub — real tenant auth is a future phase.
- The LLM never receives or chooses tenant IDs. Backend code always injects them.

## Environment variables

See `backend/.env.example` for the full list. Critical ones:

| Variable | Used by |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `LIVEKIT_URL` | Agent worker + RoomServiceClient |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Agent worker + token generation |
| `OPENAI_API_KEY` | LiveKit inference (LLM) + direct embeddings |

## Phase status

See `IMPLEMENTATION_PHASES.md` for the full log.

- **Done**: Phases 0–4 (TypeScript, Neon/Drizzle schema, service layer, tool-based agent, admin routes)
- **Next**: Phase 5 — LiveKit SIP wiring (inbound trunk + dispatch rule) + SMS on escalation resolve
- **Later**: Phase 6 — Google Calendar (check_availability, book_appointment tools)
- **Later**: Phase 7 — Frontend TypeScript migration + TanStack Query + full admin dashboard views
