# CLAUDE.md — Branch

You are implementing **Branch**, the product defined in `PRD.md`. Treat that PRD as the source of truth for product behavior and release scope. Do not invent additional features or broaden the MVP without asking.

## Current status (updated 2026-11-03)

**Phase 1 (Foundation) in progress.** The Phase 1 plan was approved on 2026-11-03; decisions, dependency pins, and the per-milestone log live in `docs/DECISIONS.md`. Setup and commands are in `README.md`.

| Milestone | Status |
|---|---|
| M0 Workspace and tooling | Done |
| M1 Design system and app shell | Done |
| M2 Authentication and profiles | Done |
| M3 Domain schema and seed data | Done |
| M4 Groups, membership, invites, admin | **Next** |
| M5 Roadmaps (curated, custom, versions) | Planned |
| M6 Group plans and weekly schedules | Planned |
| M7 Progress, completion, Home, branch graph | Planned |
| M8 E2E journeys, accessibility pass, docs | Planned |

**Approved Phase 1 decisions** (details in `docs/DECISIONS.md`): verified seed catalog plus a JSON importer, with NeetCode 150 / Blind 75 / Grind 75 drafted from cited public sources for owner review before being marked curated; email/password plus optional GitHub OAuth with no email delivery; group members see each other's status on assigned problems only; users may add problems by LeetCode URL (`source: USER`); exactly one admin per group; link-based hashed invites; weeks computed from the plan's start date and IANA timezone (Monday default); Review nav hidden until Phase 4; commit at the end of each milestone and push `main`.

### Working in this repository

- **Checks before any milestone commit:** `pnpm check` (typecheck, lint, format, unit, integration), `pnpm build`, `pnpm test:e2e`. Requires `pnpm db:up`.
- **Pinned versions:** TypeScript 6.0 (typescript-eslint caps below 6.1), Prisma 7.10 (npm `latest` is an 8.0 RC; Better Auth supports ≤7), ESLint 9 (Next's lint plugins). Do not bump these without checking compatibility.
- **Prisma 7:** `pnpm db:migrate` regenerates the client; Prisma no longer does it on its own. Constraints Prisma can't express (CHECK, partial unique indexes, triggers) go in the migration SQL, with an integration test proving each one.
- **Data invariants enforced by the database:** one admin per group, one active plan per group, one draft per roadmap, one completion per user and problem, published roadmap versions immutable (triggers), weekly assignments only from the plan's own version (composite foreign keys). Services should translate these violations into friendly errors, not re-implement them.
- **Seed and catalog:** `pnpm db:seed` (idempotent) loads `packages/database/prisma/data/` through the validated contracts in `@branch/shared/catalog` and the importer in `@branch/database/catalog-import`. Dev accounts: `ada@example.test` / `grace@example.test`, password `branch-dev-password`.
- **Authorization:** every app page and server action starts from `requireViewer()` (`apps/web/src/modules/auth/session.ts`). `src/proxy.ts` is an optimistic cookie check only. Never accept user IDs from the client. Return paths go through `safeNextPath()`.
- **Module shape:** `apps/web/src/modules/<domain>/` holds `schemas.ts` (Zod), `service.ts` (server-only domain logic and authorization), `actions.ts` (server actions returning `FormState`), and colocated `*.test.ts` / `*.int.test.ts`.
- **Tests:** unit tests need no database; `*.int.test.ts` run against `TEST_DATABASE_URL`, which is reset before each test; E2E creates a fresh account per test through the `viewer` fixture (`apps/web/e2e/support/fixtures.ts`). The reset helper refuses any database not ending in `_test`.
- **Design system:** tokens in `apps/web/src/app/globals.css`. Orange marks progress data, the logo, and focus only; never buttons, tabs, or nav. The primary action is an inverted pill. Elevation is a lightness step, not borders or shadows. Every text colour must hold 4.5:1 and control outlines 3:1 in both themes.
- **Taste skill** (`.claude/skills/design-taste-frontend`, pinned in `skills-lock.json`): use only its app-screen guidance and `lint.mjs --app` / `inspect.mjs --app` against local pages. Do not run `assets.mjs`, follow its gallery links, or adopt its CDN libraries. Where it conflicts with the PRD's restraint, the PRD wins. Its security-scan flags were reviewed and are recorded in `docs/DECISIONS.md`.
- **21st.dev:** visual reference only; no API key or MCP.

## Mission and non-negotiables

Build **Branch**, a polished **Strava-for-LeetCode** social accountability web app, not a coding judge. Deliver working, tested increments. The initial audience is friends; design boundaries so the product can grow without a rewrite. **Keep ongoing hosting costs as close to zero as practical.** Do not introduce paid infrastructure without explaining why and obtaining approval.

**Key rules:**
- Home is a unified, feed-first experience across the user's authorized groups, with filters.
- Shared group roadmap and calendar-based weekly assignments; individual progress can lag or lead.
- A solved canonical problem counts once per user and updates all applicable roadmap views.
- Users control whether achievements are posted. Never expose source code or weakness metrics by default.
- Dark-first design; support Dark, Light, System (default System) from the beginning.
- No notifications in v1.
- Build each phase end-to-end, test it, and report results before starting the next.

## Proposed stack

| Area | Choice | Notes |
|---|---|---|
| Web | Next.js (App Router), React, TypeScript | Prefer server components for reads where useful; client components for interactivity |
| UI | Tailwind CSS, shadcn/ui, accessible primitives | Centralized theme tokens; use 21st.dev selectively and review adopted code |
| Database | PostgreSQL + Prisma | Neon is a candidate; validate free-tier terms/limits before deploying |
| Auth | Better Auth | Email/OAuth as configured; secure sessions and server-side authorization |
| Extension (phase 3) | WXT + TypeScript | Opt-in permissions, secure ingestion, site-change resilience |
| Analyzer (phase 4) | Python + FastAPI | Async jobs, static-first, provider-independent optional LLM analysis |
| Workspace | pnpm monorepo | Shared validation/types; Docker Compose for local dependencies |
| Realtime (phase 5) | Adapter; choose later | Avoid a paid dependency before needed |
| Media | Object storage adapter; choose later | Upload validation, quotas, access control |

Prefer a **modular monolith** for the web/API. The analyzer is an independently deployable worker only when needed. Avoid Kubernetes, unnecessary microservices, or bespoke infrastructure at launch.

## Repository layout

```text
apps/
  web/                 # Next.js UI, server actions/route handlers, modules
  extension/           # WXT extension (phase 3)
services/
  analyzer/            # FastAPI and worker (phase 4)
packages/
  database/            # Prisma schema, migrations, seeders
  shared/              # Zod schemas, domain contracts, types
  ui/                  # Shared design primitives, if warranted
infra/
  docker/              # Local compose/configuration
PRD.md
CLAUDE.md
```

Create directories only as their phase requires them. Don't scaffold empty microservices for hypothetical future use.

## Engineering conventions

- TypeScript strict mode. Prefer small cohesive modules with explicit domain boundaries (`auth`, `groups`, `roadmaps`, `progress`, `feed`, `review`, `integrations`, `chat`).
- Validate all untrusted input at the boundary (Zod or equivalent); authorize every server-side operation independently.
- Database migrations are reviewed, versioned, and reversible where possible. Use foreign keys, uniqueness constraints, and appropriate indexes.
- All external providers behind interfaces/adapters. Do not embed vendor-specific logic into domain services.
- Favor simple server-rendered pages, accessible interactions, optimistic UI only when rollback/error behavior is clear.
- Cursor pagination for growing feeds/comments; avoid N+1 queries and unbounded list fetches.
- Idempotency for accepted submissions, completion creation, auto-generated activities, and background jobs.
- Handle errors with useful user feedback, structured logs, and no leaked secrets or raw internal stack traces.
- Add tests with each feature. Prefer unit tests for domain rules, integration tests for authorization/data, and browser tests for critical user journeys.
- Do not claim code complexity can always be inferred accurately; surface confidence and limitations.

## Design system

**Inspiration:** Strava's activity-first social engagement, with Linear/Vercel-style restraint. Dark mode primary: charcoal surfaces, subtle borders, legible typography, restrained orange accent. Light mode: off-white canvas and white surfaces. `System` is default; support explicit `Dark` and `Light` preferences.

Use CSS variables/design tokens for colors, radii, spacing, shadows, and motion. Support responsive desktop three-column feed (left nav, center feed, right weekly summary) and mobile single-column feed with bottom navigation. Provide keyboard focus, contrast, reduced motion, and robust loading/empty/error states. Celebrate meaningful milestones subtly; avoid gratuitous gamification.

**21st.dev:** https://21st.dev — use as a component inspiration/source when useful, including its official Claude Code integration if currently supported. Check compatibility and accessibility; adapt to the project's tokens. Do not paste unrelated components that create visual inconsistency. Never treat third-party examples as inherently safe.

### Branch brand rules

- Display name: **Branch**. Optional logo wordmark: **`branch.`** (lowercase with a period). Never treat a former generic project name as the public-facing product name.
- Working tagline: **"Grow together. Solve better."** Use only where a tagline fits; the user may revise it later.
- Initial visual direction: minimal original branching-path/nodes mark, comfortable sans-serif typography, restrained Strava-inspired orange, charcoal dark surfaces, and clean off-white light surfaces.
- Starting palette reference: dark canvas `#17191D`, dark surface `#262A30`, muted text `#A4A7AD`, orange accent `#FF683B`, light canvas `#F7F7F5`. Implement semantic CSS variables (e.g., `--background`, `--foreground`, `--surface`, `--accent`) rather than scattering hex values. Adjust tokens to meet contrast requirements.
- Use Branch consistently in UI headings, browser/app metadata, onboarding, docs, extension UI when implemented, and project readme. A temporary branch glyph/favicon is fine, but do not present it as trademark-cleared original artwork.
- Keep `group`, `roadmap`, `weekly assignment`, and `review` as domain terms; do not rename these entities after the brand without discussion. A group is not a Git branch.
- `branch` is a reasonable repository/package slug subject to availability. Do not assert ownership of any domain or handle; check name/logo rights before any public launch.
- Brand should feel motivating but never turn into forced streak pressure, fake social proof, or performance shaming.

## Domain invariants

1. **Authorization:** membership is required for group-scoped reads/writes. Admin privileges required for roadmap/schedule and membership management.
2. **Canonical completion:** unique `(userId, problemId)` for accepted completion; maintain separate submission history. Multiple groups/roadmaps derive progress from the same completion.
3. **Roadmap stability:** a group plan references an immutable roadmap version/snapshot; admin edits use explicit migration/reassignment semantics.
4. **Calendar advancement:** assignments move on schedule in a group's IANA timezone; missing work remains backlog, not erased.
5. **Feed privacy:** unified feed aggregates only activities visible to the current user. Group labels and filter apply to authorized results only.
6. **Posting control:** completion does not imply sharing. Auto-posting is opt-in; user may suppress an individual post. No duplicated activity for repeated submissions.
7. **Private analysis:** code, weakness estimates, review queue, and detailed complexity results are private unless explicitly shared.
8. **Review separation:** spaced repetition and new targeted practice are distinct from roadmap completion.

## Suggested schema design (refine during Phase 1)

- `User`, auth tables, `UserPreference` (appearance, posting preference)
- `Group`, `GroupMembership` (role), `GroupInvite`
- `Problem` (canonical LeetCode identity), `ProblemTag`
- `Roadmap`, `RoadmapVersion`, `RoadmapSection`, `RoadmapItem`
- `GroupRoadmapPlan`, `WeeklyAssignment` (or schedule records)
- `ProblemCompletion` (unique user/problem), `Submission` (source, external ID, code retention choice)
- `Post`, `Activity` (auto/manual semantics), `Comment` (parent ID), `Reaction`, `MediaAsset`
- Later: `ReviewSchedule`, `ReviewAttempt`, `ConceptProficiency`, `AnalysisJob`, `AnalysisResult`, `GroupMessage`

Use foreign keys, compound uniqueness constraints, membership indexes, and time-ordered feed indexes. Be careful that a completion may affect multiple roadmaps but must not broadcast private activity into every group.

## API and async patterns

- Use typed service functions called by Next.js route handlers/server actions. Keep transport separate from domain logic.
- Validate request bodies and enforce per-resource authorization; do not rely on hidden UI controls.
- Use transactions for completion + progress-relevant events and an outbox/idempotent job mechanism if async publishing becomes necessary.
- Extension sync should authenticate the user, validate origin/context and payload, deduplicate by stable external submission ID when possible, and never require LeetCode credentials in our app.
- Analysis runs asynchronously; progress updates should not wait for it. Cache by normalized code hash + language + problem + analyzer version. Rate-limit and budget expensive calls. Treat static estimates and LLM outputs as uncertain signals, not ground truth.
- File uploads require MIME/size checks, object storage authorization, and a deletion path.

## Phase-by-phase execution plan

### Phase 1 — Foundation and roadmap MVP

1. Bootstrap pnpm workspace, Next.js, strict TypeScript, Tailwind/shadcn, formatting/linting, tests, env template, Docker Compose for local Postgres.
2. Implement Branch identity in the responsive app shell (display name, temporary logo/favicon, page metadata), semantic theme tokens, navigation, and Dark/Light/System persistence.
3. Add Better Auth and user profiles.
4. Model groups, memberships, invites, admin transfer, canonical problems, roadmap versions/sections/items, group plans, weekly assignments, completions.
5. Implement group creation/join flow, roadmap selection and custom roadmap authoring, admin scheduling, this-week/backlog/progress views, manual completion.
6. Seed a small **legally sourced/verified** problem set for development; do not fabricate full NeetCode/Blind/Grind mappings.
7. Tests: private group isolation, role checks, timezone/week advancement, work ahead/backlog, same problem in multiple groups, duplicate completion prevention.

**Done when:** Two test users can join one group, see synchronized assignments, and track independent progress; all tests pass.

### Phase 2 — Social experience

1. Build unified authorized feed, chronological cursor pagination, group filters, desktop/mobile layout.
2. Implement auto-generated completion/milestone activities respecting opt-in and no duplicates.
3. Manual posts: text/Markdown, syntax-highlighted code, image uploads, help requests, spoiler controls.
4. Reactions, two-level threaded comments, delete/edit controls, basic abuse limits.
5. Tests: cross-group isolation, disabled auto-sharing, repeated submission, Markdown sanitization, comment permissions.

**Done when:** Members can post questions with code/images, react/reply, and see only authorized group activity.

### Phase 3 — LeetCode extension

1. **Feasibility spike first:** verify current LeetCode DOM/network behavior, accepted-result detection, and whether code is accessible with user consent. Document limitations.
2. Build WXT extension with minimal host permissions, explicit connect/disconnect, clear disclosure.
3. Implement secure idempotent submission ingestion, metadata mapping, retry/error handling.
4. Ensure manual completion remains first-class and fallback works if LeetCode changes.
5. Test duplicate events, extension reconnect, malformed payloads, unauthorized requests.

**Done when:** Supported accepted submissions sync once without exposing source to groups; failures do not corrupt progress.

### Phase 4 — Review and analysis

1. Build spaced-repetition scheduling with explicit review outcomes.
2. Add concept-level proficiency model and targeted new-problem suggestions; explain recommendation reasons.
3. Introduce queue abstraction and Python FastAPI analysis worker; static-first parsing/heuristics, optional model-provider adapter.
4. Store confidence, analyzer version, and tradeoffs for complexity estimates; no automatic tutoring/optimal-answer reveal.
5. Add caching, cost ceilings, rate limits, retries, privacy/retention settings, evaluation cases.

**Done when:** A user receives useful private review suggestions; analysis is asynchronous, bounded, and uncertainty-aware.

### Phase 5 — Chat and production hardening

1. Implement group-scoped persisted chat with replaceable realtime adapter.
2. Add spoiler handling, basic moderation safeguards, pagination, and reconnect behavior.
3. Performance, accessibility, security, error handling, observability, deployment checks.
4. Verify free-tier terms/limits and write a scaling runbook for database, media, queue, and realtime upgrades.

**Done when:** Group chat works reliably and the app is deployable without unnecessary fixed costs.

## Required implementation workflow for Claude Code

For **each phase**:

1. Read the relevant PRD sections and inspect the existing repository.
2. Propose a short plan with affected files, schema changes, and acceptance tests.
3. Implement the smallest vertical slice that meets the milestone.
4. Run typecheck, lint, unit/integration tests, and relevant browser tests. Fix failures before proceeding.
5. Summarize implemented functionality, exact commands/results, migrations, known limitations, and any user decisions needed.
6. **Stop at the phase boundary and ask before moving on.** Never silently implement all five phases in one pass.

Prefer secure, simple code over speculative abstraction. Keep dependencies lean. Never commit `.env` secrets. Document setup commands in `README.md` and maintain an `.env.example`. If a requirement depends on changing external APIs, provider pricing, or permissions, verify it rather than guessing.

## Next task

Phase 1 planning is complete and approved (see **Current status** above). Continue Phase 1 milestone by milestone, starting from the first milestone marked **Next**: verify, run all checks, update `docs/DECISIONS.md`, commit, and push after each one. Update the status table here when a milestone completes. Do not start extension, analyzer, or chat work, and stop for approval at the end of Phase 1.
