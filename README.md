# Elora AI Receptionist

A telephony-first AI receptionist for appointment-based local businesses (salons, spas, clinics). Customers call a real phone number. LiveKit SIP routes the call to the Elora agent. The agent answers questions, escalates unknowns to a human admin, and books appointments via Google Calendar.

Built as a B2B SaaS portfolio project. Multi-tenant from day one.

## Key Features

- **Voice calls via SIP**: Real phone numbers routed through LiveKit SIP trunks to the AI agent
- **RAG knowledge base**: Vector embeddings (pgvector) for accurate Q&A retrieval
- **Escalation system**: Unknown questions flagged to admin; resolved answers populate the knowledge base
- **Appointment booking**: Agent checks Google Calendar availability and books confirmed events
- **Admin dashboard**: Calls, escalations, appointments, knowledge base, settings — all in one place
- **Multi-tenant**: Every table is tenant-scoped; each business is one tenant

## Project Structure

```
/                        ← npm workspace root
├── backend/             ← Hono API server + LiveKit agent worker (TypeScript)
├── frontend/            ← Admin dashboard (React + Vite)
├── PRD-v2.md            ← Product requirements
└── CLAUDE.md            ← Developer guide (architecture, patterns, decisions)
```

## Tech Stack

### Backend
- **Runtime**: Node.js (ESM, TypeScript)
- **API Framework**: Hono
- **Database**: Neon Postgres + Drizzle ORM + pgvector
- **Auth**: Clerk (`@hono/clerk-auth`)
- **Voice Agent**: LiveKit Agents Framework
  - STT: LiveKit inference
  - LLM: OpenRouter (configurable, defaults to `openai/gpt-oss-20b`)
  - TTS: LiveKit inference
  - VAD: Silero
- **Embeddings**: OpenRouter (`nvidia/llama-nemotron-embed-vl-1b-v2` by default)
- **Calendar**: Google Calendar API via Clerk OAuth tokens

### Frontend
- **Framework**: React 19 + Vite (TypeScript)
- **Routing**: React Router v7
- **Auth**: `@clerk/react`
- **Data fetching**: TanStack Query v5
- **UI**: Tailwind v4 + shadcn + Base UI
- **HTTP**: Axios

## Running the Application

All commands from workspace root.

```bash
# API server (hot reload)
npm run dev -w backend          # → http://localhost:8080

# LiveKit agent worker (separate process)
npm run agent -w backend

# Frontend dev server
npm run dev -w frontend         # → http://localhost:5173

# Database migrations
npm run db:generate -w backend
npm run db:migrate -w backend
```

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=                  # Neon Postgres connection string
LIVEKIT_URL=                   # wss://your-instance.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
CLERK_SECRET_KEY=              # JWT verification + Clerk API (OAuth token fetch)
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=           # defaults to https://openrouter.ai/api/v1
LLM_MODEL=                     # defaults to openai/gpt-oss-20b:free
EMBEDDING_MODEL=               # defaults to nvidia/llama-nemotron-embed-vl-1b-v2:free
```

### Frontend (`frontend/.env`)

```env
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_URL=http://localhost:8080/api
VITE_CLERK_SIGN_IN_URL=/sign-in
VITE_CLERK_SIGN_UP_URL=/sign-in
VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/appointments
VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/appointments
```

## Admin API Endpoints

All routes under `/api/admin/*` require a Clerk JWT (`Authorization: Bearer`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/metrics` | KPI counts |
| GET | `/admin/calls` | Call history |
| GET | `/admin/escalations` | Escalation list |
| POST | `/admin/escalations/:id/resolve` | Resolve escalation |
| GET | `/admin/knowledge` | Knowledge base items |
| DELETE | `/admin/knowledge/:id` | Delete knowledge item |
| GET | `/admin/appointments` | Appointment list |
| GET | `/admin/settings` | Tenant settings |
| PATCH | `/admin/settings` | Update tenant settings |

## License

ISC
