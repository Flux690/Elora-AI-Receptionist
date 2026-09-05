# DeskRoute

Telephony-first AI receptionist for appointment-based local businesses. A customer
calls a real number → LiveKit SIP → AI agent answers, escalates or books → the
owner sees it in the admin dashboard.

Self-hosted and open source. One deployment holds one or more **agents**: a
business's phone presence, and everything shaping how it answers. **Every table
has `agent_id`, and every repository function takes `agentId` as its first
argument.** The LLM is never given an agent id and never chooses one; backend
code injects it.

Deeper background — architecture, the agent worker, the colour system, the
database, and the measurements behind each rule — is in `CONTEXT.md`.
Read the relevant section before working in one of those areas.

## Commands

```bash
pnpm dev             # api + voice + web together
pnpm dev:api         # API server  → http://localhost:8080
pnpm dev:voice       # LiveKit worker (separate process, keep alongside the API)
pnpm dev:web         # Admin dashboard → http://localhost:5173

pnpm typecheck       # tsc --noEmit across every package
pnpm lint            # eslint, apps/web
pnpm build           # build apps/web

pnpm db:generate     # migration from schema changes
pnpm db:migrate      # apply to DATABASE_URL

docker compose up -d # dev Postgres on 5432, throwaway test Postgres on 5433
pnpm test            # unit + agent tests (no DB, no network)
pnpm test:int        # repository tests against the test Postgres
pnpm test:live       # real-credential tests; costs tokens, excluded from CI
pnpm test:web        # the design-token contract
```

## Layout

```
apps/api         Hono server: one module per resource under src/modules
apps/voice       LiveKit worker: the agent, its prompt, tools and session config
apps/web         Admin dashboard
packages/core    db, repositories, providers, domain, env
packages/shared  Domain types and constants, also consumed by the browser
```

`repositories/` wrap Drizzle, `providers/` reach external services (Google,
LiveKit, R2), `domain/` is pure logic with no I/O. Cross-package imports use the
package name with a `.js` specifier: `@receptionist/core/repositories/calls.js`.

**Handlers live with their routes.** Hono cannot infer path params across a
split, and `hc<AppType>()` needs chained definitions, so a module exports one
chained `Hono` instance and `routes.ts` mounts it with `app.route()`.

## Environment

Each package owns the variables it reads: `packages/core` takes `DATABASE_URL`,
`LIVEKIT_*`, `CLERK_SECRET_KEY` and `R2_*`; `apps/api` adds `PORT`,
`DASHBOARD_ORIGINS` and `CLERK_PUBLISHABLE_KEY`; `apps/voice` adds `LLM_*` and
`OPENROUTER_*`. Every schema reads `process.env` and nothing else. `.env` files
are a development convenience loaded by each app's dev script with
`--env-file-if-exists`, and by `env_file:` in Compose. A blank value counts as
unset.

## Comments

Zero or one line, almost always. Two only when getting the thing wrong has a
severe consequence. Nothing trivial gets a comment. Long-form reasoning belongs
in `CONTEXT.md`.

Run `pnpm typecheck` and `pnpm lint` before calling any change done.

## Backend layering

- **Modules** — one folder per resource under `apps/api/src/modules`, each
  exporting a chained `Hono` instance. Parse input, call a repository, return a
  response. No try/catch; errors bubble to the global `onError` in `app.ts`. The
  one exception is phone-number provisioning, which releases the purchased
  number then re-throws.
- **Repositories** — all DB access, in `packages/core/src/repositories`.
- Use `AppEnv` from `apps/api/src/types.ts` on admin modules so `c.get('agentId')`
  is typed.

## Frontend conventions

- **A call site names a width; it does not measure one.** Use
  `w-field-xs/sm/md/lg` for fields and `max-w-page` / `max-w-form` /
  `max-w-narrow` for pages. Pixels are not banned — `--container-page: 960px` is
  itself pixels — they live once in `index.css` where they carry a name. A
  component may own its own width in one place; the same number at three call
  sites is the thing that goes wrong. `design-tokens.test.ts` fails on a pixel
  width under `features/` or `layout/`.
- **Nothing below 14px.** `src/tests/design-tokens.test.ts` fails the build on a
  smaller size, including arbitrary values like `text-[0.8rem]`.
- **A duration or a count is a `NumberField`.** Digits only, with the unit
  painted inside the box rather than sitting beside it or hiding in a dropdown.
  Minutes is the unit you edit in; `formatMinutes` is the unit you read in.
- **Colours come from the tokens in `index.css`**, never a hardcoded value. The
  same test enforces the four rules the system is built on.
- **Dates render in the agent's timezone** via `useAgentZone()` and the
  `timeZone` argument in `lib/formatters.ts`. The agent quotes times in
  `agents.timezone`, so the dashboard has to agree.
- **A settings row's description is one line.** If it needs two, the setting needs
  a better name.
- **No centred empty states on a list page.** A page with a heading, filters and
  a table header already explains itself; only the rows are missing, so say so in
  one muted line where they would be. `layout/EmptyState.tsx` survives for pages
  that are genuinely blank — the escalation queue and 404.
- Registry components arrive with `dark:`, `data-horizontal:` and `data-vertical:`
  utilities that are inert here. Retokenise anything `shadcn add` writes; a
  contract test scans for them.

## Never do these

Each one has a mechanism behind it. `CONTEXT.md` has the reasoning.

- **Never let a turn both speak and call a tool.** `agent/speech-guard.ts` drops
  the speech, so a caller does not hear the model's private deliberation.
- **Never add a hold phrase or `ctx.filler`.** Speech is a queue, so it stands in
  front of the tool's answer and the real reply is discarded.
- **Never enable `preemptiveTts`.** Preemptive generation is on and stays on;
  preemptive TTS sends audio built from a guess that may be thrown away.
- **Never set `turnHandling.turnDetection`.** Leaving it undefined is what
  auto-provisions the streaming turn detector and lowers the endpointing floor.
- **Never call `RoomServiceClient.deleteRoom()`** to end a call. Use
  `ctx.session.shutdown({ drain: true })`.
- **Never create per-agent SIP dispatch rules.** One deployment-wide rule with an
  empty routing filter; the agent is resolved at runtime by joining
  `sip.trunkPhoneNumber` against `phone_numbers.e164`. A rule without `trunk_ids`
  matches every inbound trunk, so a second rule collides with the first.
- **Never instantiate `new OpenAI(...)`.** Chat goes through `buildLLM()` in
  `apps/voice/src/session-config.ts`, the only place a model client is built.
- **Never read `recordCalls` to decide anything.** `recordingEnabled()` in
  `packages/core/src/providers/storage.ts` is the one value the disclosure and
  the egress call both read.

## Verify UI work against the running app

Do not reason from the source about what the browser does. A single
`getComputedStyle` call settles what an afternoon of reading the CSS will not.
Run the app and measure.

One caveat: a Chrome tab that is not the foreground tab **stops rendering**. Animations do not advance, `requestAnimationFrame` never
fires, and elements mid-transition stay in the DOM. Confirm
`document.visibilityState === 'visible'` before trusting any timing measurement.

## Versioning

`major.minor.patch`, in the root `package.json` only. **One patch bump per commit
that changes the product**, in the same commit as the work. Commits that change
nothing a customer runs — docs, tests, tooling, comments — do not bump.

## The schema

`agents` is the configuration row: `business_name` for the shop, `persona_name`
for what the receptionist calls itself, and flat columns for the greeting, the
booking window and the setup checklist. `business_hours` stays jsonb because it
is read whole and its shape varies.

`phone_numbers` is its own table, so a number changes without writing to the
agent row. `e164` is globally unique: a number reaches exactly one agent.

`callers` is who phoned. `calls.recording_key` is an object key, and the URL is
presigned per request. `appointments.service_name` holds the name as it stood at
booking, beside the live `service_id`.
