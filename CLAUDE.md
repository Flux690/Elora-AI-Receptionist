# DeskRoute

Telephony-first AI receptionist for appointment-based local businesses. A customer
calls a real number → LiveKit SIP → AI agent answers, escalates or books → the
owner sees it in the admin dashboard.

Multi-tenant B2B SaaS. **Every table has `tenant_id`, and every service function
takes `tenantId` as its first argument.** The LLM is never given a tenant id and
never chooses one; backend code injects it.

Deeper background — architecture, the agent worker, the colour system, the
database, and the approaches that were tried and abandoned — is in `CONTEXT.md`.
Read the relevant section before working in one of those areas.

## Commands

```bash
pnpm dev             # api + agent + ui together
pnpm dev:backend     # API server  → http://localhost:8080
pnpm dev:agent       # LiveKit agent worker (separate process, keep alongside API)
pnpm dev:frontend    # Admin dashboard → http://localhost:5173

pnpm typecheck       # tsc --noEmit across shared, backend, frontend
pnpm lint            # eslint, frontend
pnpm build           # build frontend

pnpm -F backend db:generate   # migration from schema changes
pnpm -F backend db:migrate    # apply to Neon Postgres

docker compose up -d          # throwaway Postgres for tests, host port 5433
pnpm -F backend test          # unit + agent tests (no DB, no network)
pnpm -F backend test:int      # service tests against the Docker Postgres
pnpm -F backend test:live     # real-LLM tests; costs tokens, excluded from CI
```

Run `pnpm typecheck` and `pnpm lint` before calling any change done.

## Backend layering

- **Routes** — path, method and a handler reference. No logic.
- **Controllers** — parse input, call a service, return a response. No try/catch;
  errors bubble to the global `onError` in `index.ts`. The one exception is
  phone-number provisioning, which releases the purchased number then re-throws.
- **Services** — all DB access. The one exception is `controllers/metrics.ts`,
  which queries `db` directly for aggregates.
- Use `AppEnv` / `AppContext` from `src/types.ts` on admin routes and controllers
  so `c.get('tenantId')` is typed.

## Frontend conventions

- **Never state a width in pixels at a call site.** Use `w-field-xs/sm/md/lg` for
  fields and `max-w-page` / `max-w-form` for pages.
- **Nothing below 14px.** `src/tests/design-tokens.test.ts` fails the build on a
  smaller size, including arbitrary values like `text-[0.8rem]`.
- **A duration or a count is a `NumberField`.** Digits only, with the unit
  painted inside the box rather than sitting beside it or hiding in a dropdown.
  Minutes is the unit you edit in; `formatMinutes` is the unit you read in.
- **Colours come from the tokens in `index.css`**, never a hardcoded value. The
  same test enforces the four rules the system is built on.
- **Dates render in the tenant's timezone** via `useTenantZone()` and the
  `timeZone` argument in `lib/formatters.ts`. The agent quotes times in
  `tenants.timezone`, so the dashboard has to agree.
- **A settings row's description is one line.** If it needs two, the setting needs
  a better name.
- Registry components arrive with `dark:`, `data-horizontal:` and `data-vertical:`
  utilities that are inert here. Retokenise anything `shadcn add` writes; a
  contract test scans for them.

## Never do these

Each one cost real debugging. `CONTEXT.md` has the reasoning.

- **Never let a turn both speak and call a tool.** `agent/speech-guard.ts` drops
  the speech; a caller once heard the model's private deliberation.
- **Never add a hold phrase or `ctx.filler`.** Speech is a queue, so it stands in
  front of the tool's answer and the real reply is discarded.
- **Never enable `preemptiveTts`.** Preemptive generation is on and stays on;
  preemptive TTS sends audio built from a guess that may be thrown away.
- **Never set `turnHandling.turnDetection`.** Leaving it undefined is what
  auto-provisions the streaming turn detector and lowers the endpointing floor.
- **Never call `RoomServiceClient.deleteRoom()`** to end a call. Use
  `ctx.session.shutdown({ drain: true })`.
- **Never create per-tenant SIP dispatch rules.** One platform-wide rule with an
  empty routing filter; the tenant is resolved at runtime from
  `sip.trunkPhoneNumber`. This was tried, and every new tenant collided.
- **Never instantiate `new OpenAI(...)`.** Chat goes through `buildLLM()` in
  `agent/session-config.ts`; `src/llm.ts` is for embeddings only.

## Verify UI work against the running app

Do not reason from the source about what the browser does. Two bugs in one day
were misdiagnosed that way when a single `getComputedStyle` call had the answer.
Run the app and measure.

One caveat learned the same day: a Chrome tab that is not the foreground tab
**stops rendering**. Animations do not advance, `requestAnimationFrame` never
fires, and elements mid-transition stay in the DOM. Confirm
`document.visibilityState === 'visible'` before trusting any timing measurement.

## Versioning

`major.minor.patch`, in the root `package.json` only. **One patch bump per commit
that changes the product**, in the same commit as the work. Commits that change
nothing a customer runs — docs, tests, tooling, comments — do not bump.
