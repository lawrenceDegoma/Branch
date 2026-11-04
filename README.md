# Branch

**Grow together. Solve better.**

Branch is a social accountability app for developers practicing coding-interview problems with
friends: shared roadmaps, calendar-based weekly assignments, and individual progress tracking. You
still solve problems on LeetCode; Branch tracks the progress and community around that work. It is
not affiliated with LeetCode or NeetCode.

## What works today (Phase 1)

- **Accounts:** email and password sign-up (optional GitHub sign-in), a username and timezone,
  profile, and Dark / Light / System appearance that follows your account.
- **Groups:** create a private group, invite friends with a link (expiring, limited uses,
  revocable), one admin who can remove members or hand the role on.
- **Roadmaps:** two curated lists (Patterns 150, Essentials 75) and your own roadmaps with
  sections, versions, and optional link sharing. Problems open on LeetCode; Premium ones also link
  to a free version.
- **Weekly plans:** the admin picks a roadmap, start date, and pace; the problems spread across
  weeks that advance on the group's calendar.
- **Progress:** mark problems solved once and it counts in every group and roadmap. Home shows
  this week across your groups, next week for working ahead, and your backlog. The group page
  shows who solved this week's problems and a branch graph of everyone's progress.

There is no activity feed, browser extension, review queue, or chat yet; those are later phases
(see the PRD).

## Try it locally

After the setup below, sign in as `ada@example.test` and open **Home**: one problem waits in the
backlog, and this week's problems can be checked off. Open **Groups → Interview prep crew** to see
Grace's progress beside Ada's on the branch graph, then sign in as `grace@example.test` in another
browser to see the same week from the member's side.

## Documentation

- Product requirements: [PRD.md](PRD.md)
- Engineering specification: [CLAUDE.md](CLAUDE.md)
- Architecture decisions and milestone log: [docs/DECISIONS.md](docs/DECISIONS.md)
- Deploying to Neon and Vercel, and issuing password reset links: [docs/DEPLOY.md](docs/DEPLOY.md)

## Prerequisites

| Tool           | Version                                      |
| -------------- | -------------------------------------------- |
| Node.js        | 22.12 or newer (see `.nvmrc`)                |
| pnpm           | 10.20 (pinned via `packageManager`)          |
| Docker Desktop | Any recent version, for the local PostgreSQL |

## Local setup

```bash
pnpm install                 # installs dependencies and generates the Prisma client
cp .env.example .env         # then set BETTER_AUTH_SECRET (see below)
pnpm db:up                   # starts PostgreSQL 18 and waits until it is healthy
pnpm db:migrate              # applies migrations to the development database
pnpm db:seed                 # catalog, curated roadmaps, dev accounts, a group with a plan (idempotent)
pnpm dev                     # http://localhost:3000
```

`pnpm db:down` stops the database; data persists in the `branch_postgres-data` Docker volume.

Seeded development accounts (local only; the seed refuses to run with `NODE_ENV=production`):

| Account              | Password              | Role in "Interview prep crew" |
| -------------------- | --------------------- | ----------------------------- |
| `ada@example.test`   | `branch-dev-password` | Admin                         |
| `grace@example.test` | `branch-dev-password` | Member                        |

The group follows the sample roadmap from last Monday (so week 2 is in progress). Ada has one
problem left in her backlog; Grace has finished week 1 and solved one problem ahead.

## Environment variables

All configuration lives in a single `.env` at the repository root (never committed). Every variable
is server-only.

| Variable                                    | Required                  | Purpose                                                                                                         |
| ------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | Yes                       | PostgreSQL connection string for the app and Prisma CLI.                                                        |
| `TEST_DATABASE_URL`                         | For E2E/integration tests | Disposable database used by automated tests. Never point it at real data.                                       |
| `BETTER_AUTH_SECRET`                        | Yes                       | Signs sessions. At least 32 characters: `openssl rand -base64 32`.                                              |
| `BETTER_AUTH_URL`                           | Yes                       | Public origin of the app, e.g. `http://localhost:3000`.                                                         |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | No (set both or neither)  | Enables "Continue with GitHub". Create an OAuth app with callback `<BETTER_AUTH_URL>/api/auth/callback/github`. |

The server validates its environment at startup and reports invalid variable names without echoing
their values.

## Commands

Run from the repository root.

| Command                  | What it does                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`               | Next.js dev server                                                                                                |
| `pnpm build`             | Production build of the web app                                                                                   |
| `pnpm start`             | Serve the production build                                                                                        |
| `pnpm typecheck`         | Strict TypeScript across all packages                                                                             |
| `pnpm lint`              | ESLint across all packages                                                                                        |
| `pnpm format`            | Format with Prettier (`format:check` verifies only)                                                               |
| `pnpm test`              | Unit tests (Vitest, no database)                                                                                  |
| `pnpm test:integration`  | Service and database tests against `TEST_DATABASE_URL`                                                            |
| `pnpm test:e2e`          | Browser tests (Playwright, desktop + mobile, uses the test DB)                                                    |
| `pnpm check`             | Typecheck, lint, format check, unit and integration tests                                                         |
| `pnpm db:up` / `db:down` | Start / stop local PostgreSQL                                                                                     |
| `pnpm db:migrate`        | Create and apply a migration in development                                                                       |
| `pnpm db:deploy`         | Apply committed migrations (production/CI)                                                                        |
| `pnpm db:reset`          | Drop, recreate, and re-migrate the development database                                                           |
| `pnpm db:generate`       | Regenerate the Prisma client                                                                                      |
| `pnpm db:seed`           | Load development seed data (idempotent)                                                                           |
| `pnpm db:import-curated` | Import an approved catalog and curated roadmaps (any environment; see `packages/database/prisma/data/SOURCES.md`) |
| `pnpm db:studio`         | Browse data in Prisma Studio                                                                                      |

First-time E2E setup: `pnpm --filter @branch/web exec playwright install chromium`. Integration and
E2E runs migrate and empty the test database themselves; they refuse to touch a database whose name
does not end in `_test`.

After editing `packages/database/prisma/schema.prisma`, run `pnpm db:migrate` (it regenerates the
client; Prisma 7 no longer does this automatically).

## Repository layout

```text
apps/web/            Next.js App Router app (UI, server actions, route handlers, domain modules)
packages/database/   Prisma schema, migrations, seed data, catalog importer, Prisma client
packages/shared/     Contracts and pure logic shared across apps (catalog, calendar weeks, schedules)
infra/docker/        Docker Compose for local PostgreSQL (dev + test databases)
docs/                Architecture decisions and milestone log
```

Directories for the browser extension (`apps/extension`) and analysis service (`services/analyzer`)
are created only when their phases begin.

## Health check

`GET /api/health` returns `200 {"status":"ok"}` when the database is reachable, otherwise
`503 {"status":"unavailable"}`.

## Status

Phase 1 (Foundation) is complete and awaiting the owner's approval before Phase 2 (the social
feed). See [docs/DECISIONS.md](docs/DECISIONS.md) for the milestone log and known limitations.
