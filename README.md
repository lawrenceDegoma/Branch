# Branch

**Grow together. Solve better.**

Branch is a social accountability app for developers practicing coding-interview problems with
friends: shared roadmaps, calendar-based weekly assignments, and individual progress tracking. You
still solve problems on LeetCode; Branch tracks the progress and community around that work. It is
not affiliated with LeetCode or NeetCode.

## What works today

- **Accounts:** sign-up with Google or GitHub (password accounts from before can move theirs over,
  keeping everything; with neither configured, password sign-up stays on), a username and timezone,
  profile, and Dark / Light / System appearance that follows your account.
- **Groups:** create a private group, invite friends with a link (expiring, limited uses,
  revocable), one admin who can remove members or hand the role on.
- **Roadmaps:** two curated lists (Patterns 150, Essentials 75) and your own roadmaps with
  sections, versions, and optional link sharing. Problems open on LeetCode; Premium ones also link
  to a free version.
- **Weekly plans:** the admin picks a roadmap, start date, and pace; the problems spread across
  weeks that advance on the group's calendar.
- **Feed:** Home shows posts from all your groups, with a group filter; each group page shows its
  own. Write Markdown posts to one group, optionally about a problem in its plan; edit or delete
  your own; admins can remove posts in their group. Code blocks that name their language are
  highlighted, and a post marked "Contains spoilers" keeps its code folded until each reader
  opens it.
- **Sharing solves:** with "Share my solves" on (Settings; off by default), marking a problem
  solved posts it to groups whose plan includes it, along with finished weeks and plans;
  unmarking takes the post down, and you can hide any single one. With "Add my code to my solve
  posts" also on, a solve the extension synced shows its code, folded as a spoiler.
- **Reactions and comments:** react to posts with kudos, impressive, helpful, or same here, and
  discuss it in a comment thread that opens inside the post (spoilers work there too).
- **LeetCode extension:** install it from the Chrome Web Store, connect it in Settings, and
  submissions accepted on leetcode.com or neetcode.io sync as completions. Your code stays private,
  on your Solutions page, which you can clear at any time.
- **Review:** problems you've solved come back on a spaced schedule. Rate each review (couldn't
  solve, struggled, solved, easy) and it sets when the problem returns. Topics you keep
  struggling with get suggested problems to practice, easiest first, with the reason. Private to
  you.
- **Progress:** mark problems solved once and it counts in every group and roadmap. Home shows
  this week across your groups, next week for working ahead, and your backlog. The group page
  shows who solved this week's problems and a branch graph of everyone's progress.

- **Code analysis:** on the Solutions tab, each solution (synced, or pasted) gets an
  estimate of its time and space complexity, with what its letters mean, a confidence level, and
  the reasons. Python only for now; read by Branch's own analyzer, never run, private to you, and
  off with one setting. Share a solution to a group yourself if you want to.

- **Study timer:** start and stop a study session from Home. When it ends, share it to a group
  ("Studied for 45 min") or keep it to yourself, and remember the choice if you like.
- **Your stats:** a private page of solves per week and by difficulty, study time, typical time
  per problem, topics, and recent reviews and study sessions. No streaks or rankings.
- **Reporting and blocking:** report a post or comment to the group's admin (who removes it or
  keeps it up, never seeing who reported), or block someone so their writing is hidden for you
  and they can't reply to you.
- **What's new:** after an update, Home shows a card saying what changed, with a link to its
  details; every update is listed at `/changelog` (also linked from Settings).

Posts are text and code only (no image uploads, by choice). Chat is still to come (see the PRD).

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
| Node.js        | 26 (see `.nvmrc`; production uses the same)  |
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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No (set both or neither)  | Enables "Continue with Google" (redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google`).                     |
| `BLOB_READ_WRITE_TOKEN`                     | No                        | Vercel Blob, for uploaded profile photos. Unset locally: photos are kept in `apps/web/.photos/`.                |
| `PASSWORD_SIGN_UP`                          | No                        | `"true"` keeps password sign-up open next to Google or GitHub: local development and tests only.                |
| `AUTH_RATE_LIMIT_OFF`                       | No                        | `"true"` turns the sign-in rate limiter off: only the browser tests against a production build set it.          |

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
| `pnpm test:e2e`          | Builds the extension for tests, then browser tests (Playwright, desktop + mobile, uses the test DB)               |
| `pnpm build:extension`   | Production build of the Chrome extension into `apps/extension/.output/chrome-mv3`                                 |
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
apps/extension/      Chrome extension (WXT): syncs accepted LeetCode/neetcode.io submissions to Branch
packages/database/   Prisma schema, migrations, seed data, catalog importer, Prisma client
packages/shared/     Contracts and pure logic shared across apps (catalog, calendar weeks, schedules)
infra/docker/        Docker Compose for local PostgreSQL (dev + test databases)
docs/                Architecture decisions and milestone log
```

`services/analyzer` is the code analyzer (Python, FastAPI): `pnpm test:analyzer` runs its tests and
evaluation cases, and `pnpm analyzer:dev` serves it at http://localhost:8787 (set `ANALYZER_URL`
and `ANALYZER_SECRET` in `.env` to use it locally). It needs [uv](https://docs.astral.sh/uv/).

## The Chrome extension

`apps/extension` is a Manifest V3 extension built with WXT. It watches only the traffic the
LeetCode and neetcode.io pages already make, never calls either site itself, and sends accepted
submissions to the Branch origin it was built for (production by default), with how long the
problem's page was open and in view (1.2.0; the toolbar button shows the minutes, and turns amber
past an optional budget set in the popup). How it detects a
submission is in [docs/LEETCODE-SPIKE.md](docs/LEETCODE-SPIKE.md) and
[docs/NEETCODE-SPIKE.md](docs/NEETCODE-SPIKE.md).

- **Try it against local Branch:** `WXT_BRANCH_URL=http://localhost:3000 pnpm --filter @branch/extension build`,
  then in Chrome open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and
  pick `apps/extension/.output/chrome-mv3`. Connect it from Branch's Settings → LeetCode extension.
- **Publishing:** [docs/CHROME-WEB-STORE.md](docs/CHROME-WEB-STORE.md) has the listing text,
  privacy answers, and step-by-step dashboard instructions; store images are in
  `apps/extension/store/`.
- **Production build:** `pnpm build:extension` (points at the production URL in
  `apps/extension/src/config.ts`); `pnpm --filter @branch/extension zip` packages it for the Chrome
  Web Store.
- **Tests:** unit tests for detection and the sync queue (`pnpm test`), and an E2E test that loads
  the built extension into Chromium against a fake LeetCode page (`e2e/extension-browser.spec.ts`).

## Finding errors and keeping pages fast

- Every response carries an `x-request-id`; log lines and error records quote it. Unexpected
  server errors are recorded in the database (where and what, never request contents) for 14
  days, since Vercel's free plan keeps logs for an hour. The error page shows an error code a
  person can quote; `pnpm errors` lists recent records and `pnpm errors -- <code>` the ones
  behind a code (with `DATABASE_URL` pointed at production to read the live table).
- `pnpm build` (from the repository root) ends with a client JavaScript budget
  (`apps/web/scripts/bundle-budget.mjs`; Vercel's build doesn't run it), and
  the integration tests include query budgets for the heaviest reads
  (`apps/web/src/test/query-budget.int.test.ts`). Raise either on purpose, in the same commit as
  the feature that needs it.
- `E2E_SERVER=start pnpm test:e2e` runs the browser tests against a production build, with its
  stricter Content Security Policy; the default dev server allows `eval` for hot reloading.

## Health check

`GET /api/health` returns `200 {"status":"ok"}` when the database is reachable, otherwise
`503 {"status":"unavailable"}`.

## Status

Phases 1 (Foundation), 2 (the social feed), 3 (the LeetCode extension, published on the Chrome
Web Store), and 4 (review and analysis) are complete, and so are the additions after it: code on
solve posts (opt-in), the study timer, the extension's problem timer (1.2.0, pending Chrome Web
Store review), personal stats, and the What's new changelog. Phase 5 (chat) is next, once
approved. See [docs/DECISIONS.md](docs/DECISIONS.md) for the milestone log and known limitations.
