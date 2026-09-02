# DeskRoute

An AI receptionist for appointment-based local businesses. Customers call a real US phone number - DeskRoute answers, books appointments via Google Calendar, and escalates anything it can't handle to the business owner through an admin dashboard.

Built as a multi-tenant B2B SaaS.

## Features

- **Real phone calls** - LiveKit Phone Numbers, no SIP trunk setup required
- **Answers from context** - services, pricing, business details *and the whole knowledge base* baked into the system prompt at call start, so no tool call and no retrieval round trip
- **Knowledge base** - question/answer pairs built from resolved escalations, inlined into the prompt (pgvector and the HNSW index remain for when a tenant outgrows the prompt)
- **Real opening hours** - a weekly pattern with lunch closures, days you're shut, and one-off dates for holidays. Your agent answers "are you open Saturday?" without asking you
- **Services with real durations** - each one has its own length, plus optional setup and cleanup time that blocks your calendar without the caller ever hearing about it
- **Appointment booking that respects both** - the agent only offers times you're actually open, long enough for the service booked, and free on your calendar. It re-checks the moment before it books, so a slot taken mid-conversation doesn't become a double booking
- **AI disclosure on every call** - callers are told they're speaking to an AI before anything else is said. Required by law in several US states, and not editable by the business
- **Recording is the business's choice** - turn it off and nothing is stored, and the disclosure stops claiming otherwise. Two wordings, and each call records which one it played
- **Bookings have a name on them** - the agent asks who is coming *when it books*, never while you're just asking a question. The name lands on the calendar entry, the appointment, and the caller's record for next time
- **Escalation loop** - unanswerable questions flagged for admin review; resolved answers auto-populate the knowledge base
- **Call recordings** - recorded calls get audio alongside the full transcript and AI-generated summary; transcript and summary are kept either way
- **In-browser agent test** - talk to your agent live from the dashboard, no phone call. Nothing is recorded and no call is logged, but booking is real: a test session writes a genuine appointment and calendar event
- **Admin dashboard** - the call log, a queue for answering escalations, a day-by-day view of what is booked, the knowledge base, and settings
- **Multi-tenant** - every table is tenant-scoped; each business is fully isolated


## How It Works

1. Customer calls the business's US phone number
2. LiveKit routes the call to the AI agent worker via SIP
3. Agent resolves the tenant from the number dialed, builds a system prompt with business context, and answers - the AI disclosure first (mentioning recording only if recording is on), then the business's own greeting
4. STT → LLM → TTS pipeline handles the conversation; the audio turn detector decides when the caller has finished
5. Pricing, opening hours and knowledge-base answers come straight from the system prompt - no tool calls needed
6. Genuinely unknown questions are flagged for admin review
7. Bookings: the agent asks what service and roughly when, the backend works out which slots actually exist from your hours and that service's length, and reads back two or three. The caller picks one, the agent takes their name, and it's confirmed into your calendar
8. On hang-up: transcript extracted, summary generated, call record finalized


## Versioning

`major.minor.patch`, tracked in the root `package.json`. Currently **1.0.6**.

## Screenshots

**Home** - how the phone did this month, and every call it took
<img src="screenshots/dashboard.png" alt="Home - call stats and recent call history" width="780">

**A call** - what it was about, in one line, then the whole transcript
<img src="screenshots/call-details.png" alt="A call - summary and full transcript" width="780">

**Escalations** - what your agent could not answer. Answer once, and it never asks again
<img src="screenshots/escalation.png" alt="Escalations - questions the agent could not answer" width="780">

**Settings** - one row per setting: what it is and what it does on the left, the control on the right
<img src="screenshots/settings.png" alt="Settings - services, phone number and Google Calendar" width="780">

**Opening hours** - a weekly pattern with lunch closures and days you're shut, plus one-off dates for holidays
<img src="screenshots/settings-hours.png" alt="Settings - opening hours, holidays and the booking window" width="780">

**Your agent** - the disclosure it must say, then the phrases that repeat on every call
<img src="screenshots/settings-agent.png" alt="Settings - the AI disclosure and the agent's phrases" width="780">


## Tech Stack

| Layer | Technology |
|---|---|
| API server | Hono (Node.js, ESM) |
| Database | Neon Postgres + Drizzle ORM + pgvector |
| Auth | Clerk |
| Voice pipeline | LiveKit Agents SDK |
| STT | AssemblyAI universal-3-5-pro (LiveKit Inference) |
| LLM | LiveKit Inference by default; OpenRouter via `LLM_PROVIDER` |
| TTS | Cartesia Sonic 3.5 (LiveKit Inference) |
| Embeddings | OpenAI text-embedding-3-small (via OpenRouter) |
| Noise cancellation | Krisp telephony model, SIP calls only |
| Turn detection | LiveKit audio turn detector (`inference.TurnDetector`) |
| Tests | Vitest + Docker `pgvector/pgvector:pg17` |
| VAD | Silero |
| Telephony | LiveKit Phone Numbers |
| Calendar | Google Calendar API |
| Recordings | Cloudflare R2 |
| Frontend | React 19 + Vite + TypeScript |
| Typeface | Host Grotesk, body weight 450 |
| UI | Tailwind v4 + shadcn/ui on Base UI primitives |
| Design tokens | Warm LCH ladder from one anchor plus a contrast dial, re-anchored per depth, with chroma proportional to lightness; laws and contrast floors enforced by test |
| Data fetching | TanStack Query v5 |


## Getting Started

### Prerequisites

- Node.js 22+
- [LiveKit Cloud](https://cloud.livekit.io) project with a US phone number purchased and a SIP dispatch rule configured
- [Clerk](https://clerk.com) application with Google OAuth enabled
- [Neon](https://neon.tech) Postgres database (pgvector extension enabled)
- [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket for call recordings
- [OpenRouter](https://openrouter.ai) API key (embeddings; also an optional LLM gateway, which needs credits)
- [Docker](https://www.docker.com) for the test database

### Install

```bash
git clone https://github.com/PrabhatMattoo/DeskRoute.git
cd DeskRoute
pnpm install
```

### Environment

**`backend/.env`**
```env
PORT=8080
DATABASE_URL=

LIVEKIT_URL=                   # wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

CLERK_SECRET_KEY=

DASHBOARD_ORIGINS=             # optional, comma-separated; defaults to http://localhost:5173
                               # any localhost port is accepted when a localhost origin is listed

LLM_PROVIDER=                  # "livekit" (default) or "openrouter"
LLM_MODEL=                     # id in the selected provider's format, e.g. google/gemini-3.5-flash
SUMMARY_LLM_MODEL=             # model for post-call summaries (can match LLM_MODEL)

OPENROUTER_API_KEY=            # required for embeddings; also used when LLM_PROVIDER=openrouter
OPENROUTER_BASE_URL=           # https://openrouter.ai/api/v1

EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSIONS=1536      # text-embedding-3-small outputs 1536 dimensions

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

**`frontend/.env`**
```env
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_URL=http://localhost:8080/api
```

### Database

```bash
pnpm -F backend db:generate   # generate a migration from schema changes
pnpm -F backend db:migrate    # apply to Neon
```

The migration chain creates the `vector` extension itself, so it runs against
any empty Postgres - no manual console step.

### Tests

```bash
docker compose up -d          # throwaway Postgres on host port 5433
pnpm -F backend test          # unit + agent tests (no DB, no network)
pnpm -F backend test:int      # service tests against the Docker Postgres
pnpm -F backend test:live     # real Google Calendar; needs backend/.env
pnpm -F frontend test         # the design-token contract
pnpm typecheck                # tsc --noEmit across all workspaces
```

`test:live` is the only suite that runs against real credentials. It reads the
production database to find a tenant with a connected calendar, gets that
tenant's Google token the same way a live call does, and books and cancels one
clearly-labelled event to prove the padded block is actually reserved — because
if an event covers only the appointment and not its buffers, freeBusy reports
the setup and cleanup free and the next caller is offered them. It writes
nothing to the database, and skips with a reason if no calendar is connected.
Point it at a specific tenant with `LIVE_TENANT_ID`.

The frontend suite is the colour contract rather than component tests. One
surface is given, the stage, and every other colour is a departure from it, so
the suite asserts *relationships* rather than values: the anchor holds still as
contrast moves, surfaces and controls travel in opposite directions, ink mixes
toward the pole instead of stepping a fixed distance, chroma moves in proportion
to lightness, no line is ever lighter than what it edges, every overlay carries
an edge, nothing anywhere is smaller than 14px, and every pair clears its floor
**on the ground it actually lands on**.

Break a law in `index.css` and the suite goes red. That is the point of it.

### Run

```bash
pnpm dev            # runs all three below at once via concurrently

# …or run them in separate terminals:
pnpm dev:backend    # API server → http://localhost:8080
pnpm dev:agent      # LiveKit agent worker - keep running alongside the API
pnpm dev:frontend   # Admin dashboard → http://localhost:5173
```


## API Reference

Public:

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST | `/api/onboarding` | Create tenant + purchase phone number |
| GET | `/api/onboarding/phone/search?areaCode=415` | Search available numbers (`areaCode` optional) |

Admin - `Authorization: Bearer <clerk_jwt>` required:

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/metrics?period=30d` | KPI counts |
| GET | `/api/admin/calls` | Paginated call history |
| GET | `/api/admin/calls/:id` | Call detail with transcript |
| GET | `/api/admin/calls/:id/recording` | Presigned recording URL |
| GET | `/api/admin/escalations?status=pending` | Escalation list |
| POST | `/api/admin/escalations/:id/resolve` | Resolve + add to knowledge base |
| GET | `/api/admin/knowledge` | Knowledge base items |
| DELETE | `/api/admin/knowledge/:id` | Delete knowledge item |
| GET | `/api/admin/appointments` | Appointment list |
| GET | `/api/admin/services` | Services, in display order |
| POST | `/api/admin/services` | Add a service |
| PATCH | `/api/admin/services/:id` | Update a service |
| DELETE | `/api/admin/services/:id` | Remove a service |
| GET | `/api/admin/calendar/list` | Calendars the connected Google account can write to |
| PATCH | `/api/admin/calendar` | Choose which calendar holds appointments |
| DELETE | `/api/admin/calendar` | Disconnect the calendar |
| GET | `/api/admin/settings` | Tenant settings, opening hours, booking window and recording |
| PATCH | `/api/admin/settings` | Update settings, hours or booking window |
| GET | `/api/admin/phone/search?areaCode=415` | Search available numbers (`areaCode` optional) |
| POST | `/api/admin/phone/provision` | Purchase phone number |
| DELETE | `/api/admin/phone` | Release phone number |
| POST | `/api/admin/agent/test` | Create a browser test session (room + join token) |
| DELETE | `/api/admin/account` | Delete tenant and all data |


## License

[ISC](LICENSE) © 2026 Prabhat Mattoo
