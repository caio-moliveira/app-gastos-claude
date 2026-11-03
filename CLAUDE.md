# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Greenfield. The only source of truth is `PRD.md` (Portuguese): a personal-finance web app ("Cofre") built autonomously by a coding agent and judged on production readiness. No application code exists yet — read `PRD.md` in full before starting, then update this file with real commands and structure as they appear.

The PRD is written to be executed, not discussed (§15): **do not stop to ask** when a choice is open. Apply §15.1 (follow PRD → simplest thing that works in production → least Vercel/Supabase config), record the decision in `docs/DECISIONS.md` (ADR format in §12), and continue. Only interrupt the operator for a missing credential or an irreversible action outside the repo. Make small, frequent commits.

Build order is fixed (§15.3), with a deploy at the end of each stage; a stage starts only when the previous one works in production. Out-of-scope items (§13) must not be built.

## Fixed stack (PRD §3)

- Next.js App Router, Server Components by default; Server Actions for form mutations, a streaming Route Handler for the AI chat.
- TypeScript `strict: true`, no `any`.
- Tailwind + shadcn/ui; Recharts (client-side) for charts. Responsive 360–1440 px, no horizontal scroll at 360 px.
- Supabase (Postgres + Auth + RLS) via `@supabase/ssr`; schema only in `supabase/migrations/*.sql`; `supabase-js` with CLI-generated types, no ORM.
- Vercel hosting, plain `next build`.
- OpenRouter (OpenAI-compatible, `https://openrouter.ai/api/v1`), model read from `OPENROUTER_MODEL`, called only server-side.
- Vitest; `npm test` runs the whole suite.

@AGENTS.md

## Commands

- `npm run dev`, `npm run build`, `npm run lint`, `npx tsc --noEmit`
- `npm test` — Vitest: unit (`src/**/*.test.ts`) + integration (`tests/integration/*.test.ts`, hit the hosted Supabase with ephemeral users; skipped if env vars are missing). Single file: `npx vitest run path/to/file.test.ts`; single test: add `-t "name"`.
- `npm run db:migrate` — applies pending `supabase/migrations/*.sql` to `DATABASE_URL` (own migrator, tracked in `claude.schema_migrations`). Do **not** use `supabase db push`.
- `npm run db:types` — regenerates `src/lib/supabase/database.types.ts` for schema `claude` after a migration.
- `npm run seed` — (planned) idempotent, deterministic demo data via service-role key; prints October totals for `Casa`.

## Shared Supabase project — schema `claude` only

The Supabase project `gastos-live` (ref `qiurmjzfqcheoqtsqpay`) is shared with another implementation (schema `codex`). **All our tables, functions and policies live in schema `claude`**; never create objects in `public`. Every Supabase client must pass `db: { schema: "claude" }`. `auth.users` and the Auth config are shared: triggers on `auth.users` must never raise, and `supabase config push` needs explicit operator consent (keep `supabase/config.toml` aligned with remote so a push only changes what you intend).

Env lives in `.env` (and/or `.env.local`); scripts load both via `scripts/load-env.ts`.

## Next.js 16 notes

Middleware is `src/proxy.ts`. `cacheComponents` is intentionally off (ADR-004). Route `params`/`searchParams` are Promises; type them explicitly (don't rely on generated `PageProps`, so `tsc` works on a clean clone). shadcn components are Base UI based: use the `render` prop, not `asChild`.

## Architecture rules that span the codebase

- **Money is integer cents** (`bigint`/`integer`), never float. Sign comes from `type` (`income`/`expense`/`transfer`), never from the amount (`amount_cents > 0`). Format as BRL (`pt-BR`) only at the UI edge.
- **Dates**: transaction dates are `date` (no time); timezone `America/Sao_Paulo`; UI entirely in pt-BR.
- **Financial rules are pure functions** (no DB/network) so unit tests run in memory. Balances are computed, never stored. Transfers never count as income, expense, or category spend. Budget status: `ok` < 80 % ≤ `warning` ≤ 100 % < `exceeded`; zero limit must not divide by zero; categories without a budget show no bar (not 0 %). The required named test cases are listed in §10.
- **Spaces are the tenancy boundary**: every user-data table has `space_id`, active space lives in the URL (`/s/[spaceId]/...`). Roles: `owner` / `editor` / `viewer`, exactly one owner per space.
- **Isolation is enforced in the database**, not just the UI: RLS on every table, centralized in SQL functions `is_space_member(space_id)` and `space_role(space_id)`. Cross-space references (transaction → account/category of another space) blocked by constraint/trigger *and* server validation. AI conversations are visible only to their author.
- **Keys**: the runtime app uses only the anon/publishable key + user session. `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are for local scripts only — never in `NEXT_PUBLIC_*`, never on Vercel. `OPENROUTER_API_KEY` is server-only.
- **Server-side validation** (zod) of every payload; errors in Portuguese without leaking internals.
- **No mocks in production**: all screens read/write Supabase; fake data only via the seed script.
- **AI agent is read-only**: tool calling (`get_month_summary`, `get_category_breakdown`, `list_transactions`, `get_budget_status`, `compare_periods`, `get_accounts`) queries Supabase with the user's session so RLS applies. `space_id` comes from the route, never from the model. Max 2 tool rounds, 30 s timeout, last 20 messages as context, 30 msgs/hour/user (429), transaction text treated as data not instructions. Fallback when the model returns no tool calls: inject current-month summary + budget status. OpenRouter failures must degrade gracefully (friendly chat error, rest of app unaffected). Persist messages and tool calls in `ai_conversations` / `ai_messages`.

## Required deliverables

- `README.md` in Portuguese with the sections in the order given in §12. The current `README.md` is UTF-16 encoded (PowerShell `echo`); rewrite it as UTF-8.
- `docs/DECISIONS.md` with at least the ADRs listed in §12.
- Integration tests for the RLS permission matrix (§8 "evidência obrigatória": Carla as viewer and an unrelated fourth user against `Casa` and `Pessoal`).
- Seed users/spaces/volumes per §9 — the agent's 5 reference questions (§7.4) must be answerable with exact seed numbers.

## Repo tooling

`.agents/skills/` (tracked in `skills-lock.json`) holds installed agent skills — shadcn, Vercel deploy/CLI, React/Next.js best practices, web design guidelines. Use them when relevant; don't edit them.
