# Elora AI Receptionist

A telephony-first AI receptionist for appointment-based local businesses (salons, spas, clinics). Customers call a real phone number. LiveKit SIP routes the call to the Elora agent. The agent answers questions, escalates unknowns to a human admin, and books appointments via Google Calendar.

Built as a B2B SaaS portfolio project. Multi-tenant from day one.

## Features

- **Voice calls via LiveKit Phone Numbers** — real US numbers, no SIP trunk setup required
- **Contextual answers** — services, pricing, and hours live in the system prompt; no lookup needed for common questions
- **RAG knowledge base** — vector embeddings (pgvector) for Q&A retrieval beyond the system prompt
- **Escalation system** — unanswerable questions flagged to admin; resolved answers auto-populate the knowledge base
- **Appointment booking** — agent checks Google Calendar availability and books confirmed events
- **Admin dashboard** — calls, escalations, appointments, knowledge base, and settings in one place
- **Multi-tenant** — every table is tenant-scoped; each business is one tenant

## Project Structure

```
/                        ← npm workspace root
├── shared/              ← Type contracts (domain types + API shapes), no build step
├── backend/             ← Hono API server + LiveKit agent worker (TypeScript)
├── frontend/            ← Admin dashboard (React + Vite)
└── CLAUDE.md            ← Developer guide (architecture, patterns, decisions)
```

## Tech Stack

### Backend
- **Runtime**: Node.js (ESM, TypeScript)
- **API**: Hono
- **Database**: Neon Postgres + Drizzle ORM + pgvector
- **Auth**: Clerk (`@hono/clerk-auth`)
- **Voice Agent**: LiveKit Agents SDK
  - STT: LiveKit inference (AssemblyAI universal-streaming)
  - LLM: OpenRouter — default `openai/gpt-oss-20b:free`, recommend `openai/gpt-4o-mini` for production
  - TTS: LiveKit inference (Cartesia Sonic)
  - VAD: Silero
- **Embeddings**: OpenRouter (`nvidia/llama-nemotron-embed-vl-1b-v2:free` by default)
- **Calendar**: Google Calendar API via Clerk OAuth tokens (raw fetch, no googleapis SDK)
- **Telephony**: LiveKit Phone Numbers via Twirp HTTP API

### Frontend
- **Framework**: React 19 + Vite (TypeScript)
- **Routing**: React Router v7
- **Auth**: `@clerk/react`
- **Data fetching**: TanStack Query v5
- **UI**: Tailwind v4 + shadcn/ui + Base UI
- **HTTP**: Axios

## Running the Application

```bash
# From workspace root
npm run dev:backend      # API server → http://localhost:8080
npm run dev:agent        # LiveKit agent worker (separate process)
npm run dev:frontend     # Frontend → http://localhost:5173

# Database
npm run db:generate -w backend
npm run db:migrate -w backend
```

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=
LIVEKIT_URL=                   # wss://your-instance.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
CLERK_SECRET_KEY=
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
VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

## Admin API

All routes under `/api/admin/*` require a Clerk JWT (`Authorization: Bearer`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/onboarding` | Create tenant + purchase phone number |
| GET | `/api/onboarding/phone/search` | Search available phone numbers by area code |
| GET | `/api/admin/metrics` | Dashboard KPI counts |
| GET | `/api/admin/calls` | Call history |
| GET | `/api/admin/calls/:id` | Call detail with transcript |
| GET | `/api/admin/escalations` | Escalation list |
| POST | `/api/admin/escalations/:id/resolve` | Resolve escalation + populate knowledge base |
| GET | `/api/admin/knowledge` | Knowledge base items |
| DELETE | `/api/admin/knowledge/:id` | Delete knowledge item |
| GET | `/api/admin/appointments` | Appointment list |
| GET | `/api/admin/settings` | Tenant settings |
| PATCH | `/api/admin/settings` | Update tenant settings |
| GET | `/api/admin/telephony/numbers` | Search available numbers |
| POST | `/api/admin/telephony/provision` | Provision a phone number |
| DELETE | `/api/admin/telephony/release` | Release current phone number |
| DELETE | `/api/admin/account` | Delete tenant account |

## License

ISC
