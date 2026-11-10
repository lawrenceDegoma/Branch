# CLAUDE.md — Branch

You are implementing **Branch**, the product defined in `PRD.md`. Treat that PRD as the source of truth for product behavior and release scope. Do not invent additional features or broaden the MVP without asking.

## Current status (updated 2026-11-03)

**Phases 1–4 complete.** Phase 1 soft-launched (Neon + Vercel); Phase 2 (social feed) done; Phase 3 (LeetCode extension, M15–M18) done and published on the Chrome Web Store (public, 2026-11-06; `EXTENSION_STORE_URL` set). **Phase 4 (review and analysis) complete** (M19–M22; summary in `docs/DECISIONS.md`), plan approved 2026-11-06: four review outcomes; a Python (FastAPI) analyzer as a second free Vercel project, Python solutions first; no AI model; a "paste your solution" option for people without the extension; the complexity estimate is information only, never an input to suggestions. Details in `docs/DECISIONS.md` (Review and analysis). Extension decisions (2026-11-05): stores solution code privately, Chrome only, passive only (never calls LeetCode). neetcode.io support added 2026-11-07 (extension 1.1.0; owner read neetcode.io's terms and approved naming it). Owner changes on 2026-11-04: image uploads dropped (M13 cancelled); reporting and blocking deferred to a later phase. Phase 2 decisions are in `docs/DECISIONS.md` (Social feed). The Phase 1 plan was approved on 2026-11-03; decisions, dependency pins, and the per-milestone log live in `docs/DECISIONS.md`. Setup and commands are in `README.md`.

| Milestone | Status |
|---|---|
| M0 Workspace and tooling | Done |
| M1 Design system and app shell | Done |
| M2 Authentication and profiles | Done |
| M3 Domain schema and seed data | Done |
| M4 Groups, membership, invites, admin | Done |
| M5 Roadmaps (curated, custom, versions) | Done |
| M6 Group plans and weekly schedules | Done |
| M7 Progress, completion, Home, branch graph | Done |
| M8 E2E journeys, accessibility pass, docs | Done |
| Soft launch: deploy guide (Neon + Vercel), password reset | Done |
| M9 Feed and text posts | Done |
| M10 Code highlighting and spoilers | Done |
| M11 Automatic posts (opt-in) | Done |
| M12 Reactions and comments | Done |
| M13 Images | Dropped (owner, 2026-11-04) |
| M14 Privacy journeys, accessibility, docs | Done |
| M15 Extension feasibility spike | Done |
| M16 Extension server side (connections, ingestion, submissions) | Done |
| M17 The Chrome extension | Done |
| M18 Extension journeys, docs, store listing | Done (published 2026-11-06) |
| M19 Review queue | Done |
| M20 Weak topics and suggestions | Done |
| M21 Code analysis (Python analyzer, paste your solution) | Done |
| M22 Review journeys, accessibility, docs | Done |
| M23 Solutions on solve posts | Done |
| Changelog ("What's new") | Done |
| M24 Study sessions | Done |
| M25 The extension's problem timer | Done (1.2.0 awaits store review) |
| M26 Your stats | Next |
| M27 Additions: journeys, accessibility, docs | Planned |

**Approved Phase 1 decisions** (details in `docs/DECISIONS.md`): verified seed catalog plus a JSON importer; curated lists Patterns 150 and Essentials 75 (approved 2026-11-03, see below; Grind 75 skipped: no openly licensed source); email/password plus optional GitHub and Google OAuth (each enabled by its env vars) with no email delivery (since 2026-11-09, Google and GitHub only for new accounts; see Accounts below); group members see each other's status on assigned problems only; users may add problems by LeetCode URL (`source: USER`); exactly one admin per group; link-based hashed invites; weeks computed from the plan's start date and IANA timezone (Monday default); Review nav hidden until Phase 4 (shown since M19; the Profile tab was removed 2026-11-09, Settings holds profile details); commit at the end of each milestone and push `main`.

### Working in this repository

- **Checks before any milestone commit:** `pnpm check` (typecheck, lint, format, unit, integration), `pnpm build`, `pnpm test:e2e`. Requires `pnpm db:up`.
- **Pinned versions:** TypeScript 6.0 (typescript-eslint caps below 6.1), Prisma 7.10 (npm `latest` is an 8.0 RC; Better Auth supports ≤7), ESLint 9 (Next's lint plugins). Do not bump these without checking compatibility.
- **Prisma 7:** `pnpm db:migrate` regenerates the client; Prisma no longer does it on its own. To name a new migration, run `pnpm exec prisma migrate dev --name <name>` then `pnpm exec prisma generate` in `packages/database` (the script passes extra arguments to `generate`, so `migrate dev` waits for a name). Constraints Prisma can't express (CHECK, partial unique indexes, triggers) go in the migration SQL, with an integration test proving each one.
- **Data invariants enforced by the database:** one admin per group, one active plan per group, one draft per roadmap, one completion per user and problem, published roadmap versions immutable (triggers), weekly assignments only from the plan's own version (composite foreign keys). Services should translate these violations into friendly errors, not re-implement them.
- **Production:** `docs/DEPLOY.md` (Neon Free + Vercel Hobby). Migrations run from the owner's machine with `DATABASE_URL=<direct> pnpm db:deploy` before pushing; curated data with `pnpm db:load-curated`; never `db:seed`. No email: password resets are owner-issued with `pnpm auth:reset-link -- <email>`, which writes a token in Better Auth's `reset-password:<token>` format (pinned by `e2e/auth.spec.ts`; recheck when upgrading Better Auth).
- **Seed and catalog:** `pnpm db:seed` (idempotent) loads `packages/database/prisma/data/` through the validated contracts in `@branch/shared/catalog` and the importer in `@branch/database/catalog-import`. Dev accounts: `ada@example.test` / `grace@example.test`, password `branch-dev-password`.
- **Accounts:** new accounts sign up with Google or GitHub only (`disableSignUp` whenever a provider is configured; `PASSWORD_SIGN_UP=true` is for local development and E2E, never production). Password accounts from before sign in at `/sign-in/password` and move on `/account/move` by linking a provider to the same user (`linkSocialAccount`, different emails allowed), after which `finishMove` (`modules/auth/accounts.ts`) deletes the password; until then every app page shows a notice. Never link a provider to a password account by email alone. E2E accounts get a GitHub account row by default (`signUpViaApi(..., { passwordOnly: true })` for an unmoved one).
- **Profile photos** live in `modules/profile/` (`photo.ts` pure rules and `shownPhoto()`, `photo-storage.ts` the `PhotoStorage` adapter: Vercel Blob with `BLOB_READ_WRITE_TOKEN`, a local folder served by `/api/photos/[name]` outside production; `uploadPhoto`/`choosePhoto` in `service.ts`). Check uploads by their bytes, never the claimed type; never accept SVG. Delete the old upload whenever it's replaced. Any query that shows a person with `Avatar` selects `photoSelect` and passes `shownPhoto(user)`. Provider photos refresh on each sign-in (`keepChosenIdentity` in `modules/auth/link.ts` keeps only the photo from OAuth callbacks, never the name or email), and Google's daily through `refreshGooglePhotos` (`google-photos.ts`, offline access, tokens encrypted); provider tokens are used for nothing else.
- **Authorization:** every app page and server action starts from `requireViewer()` (`apps/web/src/modules/auth/session.ts`). `src/proxy.ts` is an optimistic cookie check only. Never accept user IDs from the client. Return paths go through `safeNextPath()`.
- **Private resources return 404.** Services throw `NotFoundError` for non-members and `ForbiddenError` for members lacking a role; pages wrap reads in `orNotFound()` so both render the 404 page with a real 404 status. Never put a route-level `loading.tsx` above a page that can 404 (a Suspense boundary starts streaming with status 200); `home/` is the only one.
- **Roadmap access** lives in `modules/roadmaps/service.ts` (`requireViewableRoadmap`, `requireOwnedRoadmap`): curated → every signed-in user; custom → owner, members of a group whose plan uses one of its versions, or a share-link holder (via `/roadmaps/shared/[token]` only). Drafts are owner-only. Editing replaces the single draft's content wholesale; publishing freezes it as the next version.
- **Curated lists:** Patterns 150 and Essentials 75 (owner-approved 2026-11-03) live in `packages/database/prisma/data/roadmaps/`, built from MIT-licensed NeetCode data; provenance and license notices are in `prisma/data/SOURCES.md`. **Never use other parties' list names** ("NeetCode", "Blind", "Grind") in titles or descriptions (owner decision, to avoid legal risk; a test enforces it); the required attribution is the roadmap's "Source" link. Titles follow LeetCode's official capitalization. Premium problems carry `premium` and a `freeAlternativeUrl` (https only, CHECK). New lists go in `curated-drafts/` until the owner approves them (`db:import-curated` refuses that folder without `--allow-draft`). Grind 75 is out of scope: no openly licensed source. `src/test/data-files.test.ts` validates every data file.
- **Dates and weeks:** use `@branch/shared/calendar`. Weeks are computed on calendar dates (`YYYY-MM-DD`) in the group's IANA timezone, never on instants, so DST can't shift them; week n starts `startDate + 7(n−1)`. Plan services accept a `now` argument so tests are deterministic. Schedule generation is `@branch/shared/schedule`, shared by the app and the seed.
- **Progress** lives in `modules/progress/`: `setCompletion` is the only writer of completions (idempotent, `ON CONFLICT DO NOTHING`); progress is always derived from completions, never stored. Backlog/ahead/position rules are pure functions in `standing.ts`. Group views read only completions of problems assigned in the group's plan; keep it that way (approved privacy rule). Don't rank members.
- **SQL CHECK constraints must handle NULL explicitly** (a CHECK that evaluates to NULL passes). Write `col IS NOT NULL AND ...` or `col IS NULL OR ...`, and add a test with the NULL case.
- **Feed** lives in `modules/feed/`: a post belongs to one group; reads start from the viewer's memberships, writes check membership of the post's group (non-members 404, non-authors 403). Page by post ID (UUIDv7, `?before=`). Render user text only through `components/feed/markdown.tsx` (no raw HTML, no images, safe links; fenced code highlighted by class, coloured by `--code-*` tokens; `spoiler` folds code blocks); never `dangerouslySetInnerHTML`. Automatic posts (`SOLVE`, `WEEK_DONE`, `PLAN_DONE`, no body) are written only by `syncAutomaticPosts` inside `setCompletion`'s transaction (and `RESOLVE`, "solved again", only by `announceResolve` when the extension syncs a new accepted submission of an already solved problem: at most once a week per problem and group counting the `SOLVE` post, under an advisory lock), only with `profile.shareSolves` on, only to groups whose active plan assigns the problem; undo sets `withdrawnAt`, redo clears it, the author's `hiddenAt` is permanent. Feed reads filter both. Automatic posts are never edited or deleted. Reactions (`modules/feed/reactions.ts`) and comments (`modules/feed/comments.ts`) start from `requireVisiblePost`; comments are two levels (trigger) and open inside the post's card (`CommentsDisclosure`; the feed loads each post's first threads, bounded; `/posts/[id]` is the permalink and pages long threads); deleting a comment deletes its replies (FK cascade).
- **Extension** server side lives in `modules/integrations/` (submissions record their site, `SubmissionSource` LEETCODE or NEETCODE; the contract's `source` defaults to LEETCODE for 1.0.0): `connections.ts` (bearer tokens `brx_…`, only SHA-256 stored, revocable, max 5), `submissions.ts` (`ingestSubmission` is idempotent on (user, source, LeetCode submission ID) and marks solved via `setCompletion` with source `EXTENSION`; unmatched submissions wait with `problemId` null, count via `matchWaitingSubmissions` once their slug exists, and are deleted 30 days after arrival by the daily job `/api/cron/daily`, which needs `CRON_SECRET`; reads already hide expired ones). Routes: `POST /api/extension/submissions`, `GET`/`DELETE /api/extension/connection` (JSON, `no-store`, no cookies, no CORS). Submissions and code are private to their author; never show them to groups. The extension is passive only (see `docs/LEETCODE-SPIKE.md`). The submission contract and page messages live in `@branch/shared/extension`, shared by both sides.
- **The extension** is `apps/extension` (WXT 0.21.4, pinned; MV3, Chrome) and syncs from leetcode.com and neetcode.io. `src/detect.ts` is the pure LeetCode detector (a submission counts only if its Submit was seen in that tab, then `submissionDetails` statusCode 10 with all tests passed; the page's "Accepted" label is a fallback); `src/neetcode.ts` is the pure neetcode.io detector (`executeCodeFunctionHttp` status 3 with all tests passed; the LeetCode slug comes from the problem's title in `getProblemMetadataFunctionHttp`, of which only `id` and `name` are kept; see `docs/NEETCODE-SPIKE.md`); `src/traffic.ts` is the shared observe-only fetch/XHR watcher; `entrypoints/leetcode-observer.content.ts` and `neetcode-observer.content.ts` run in the page (MAIN world); `site-relay.content.ts` validates and forwards for both sites (a payload's `source` must match the tab's site, checked again in the background); `branch-bridge.content.ts` takes the token from Branch's Settings page (`PAGE_MESSAGE`, origin-checked); `background.ts` holds the connection and a bounded queue in `storage.local`, retries with alarms, and checks every message's sender. The problem timer (1.2.0, M25): `src/timer.ts` is pure (time in view per tab, at most 45 s per report so sleep doesn't count, stopped on accept, a new timer for another problem or a reload after accepting); `site-relay.content.ts` reports the tab's problem page (`/problems/<slug>`) and visibility every 15 s while in view and on changes; `background.ts` keeps timers in `storage.session` (only while connected), shows minutes on the toolbar badge (amber past the popup's budget, `budgetMinutes` in `storage.local`), and sets `timeSpentSeconds` on an accepted submission from that tab (LeetCode: same slug; the page's own value is always discarded). Branch stores it on `submission.timeSpentSeconds` (1–86400, CHECK) and shows it only to the owner. Permissions: `storage`, `alarms`, host access to the Branch origin only. The Branch origin is fixed at build time (`WXT_BRANCH_URL`). `pnpm test:e2e` builds it (`build:e2e`) before the browser tests. Store rules: anything collected needs the prominent disclosure (`EXTENSION_DISCLOSURE` in `@branch/shared/extension-text`, shown on the welcome page, popup, and Settings) and consent by connecting; `/privacy` must stay accurate (Limited Use statement; contact from `PRIVACY_CONTACT_EMAIL`). Any change to what the extension reads or sends updates the disclosure, `/privacy`, and `docs/CHROME-WEB-STORE.md` together, and bumps the version.
- **Review** lives in `modules/review/`: `schedule.ts` (pure spaced-repetition rules: first review 3 days after solving; outcomes AGAIN/HARD/GOOD/EASY shown as Couldn't solve/Struggled/Solved/Easy), `service.ts` (`startReviews`, called only by `setCompletion` in its transaction; `recordReview`, allowed only when due and conditional on the schedule being unchanged; `getReviewQueue`, `listReviewHistory`, `countDueReviews`). `review_schedule` exists exactly while the problem is solved (composite FK to `problem_completion`, cascade); due dates are calendar dates in the user's timezone. `review_attempt` is the private history and survives unsolving. Reviews never change completion, never post, and are never shown to anyone else. Weak topics and suggestions (`topics.ts` pure rule: latest 5 reviews per topic, needs practice when struggles ≥ half or ≥ 2; `practice.ts`) are derived on every read, never stored; suggestions are unsolved free problems, easiest first, and one solved after the topic's latest struggle stays in place for a day.
- **Code analysis:** `services/analyzer` (Python 3.13, FastAPI, `uv`; `pnpm test:analyzer`, `pnpm analyzer:dev`) is stateless and only parses code (never runs or logs it). It's an abstract interpretation, not pattern matching: `values.py` (types with size symbols from type hints), `cost.py` (multi-symbol costs), `engine.py` (line counts with provable loop bounds, operation costs, recursion by structure), `report.py` (letters, the "where" line, reasons). Fix a misread by adding a general rule about why a loop stops, never a code-shape special case; bump `ANALYZER_VERSION` whenever the rules change (Branch then redoes older estimates automatically), and add an evaluation case to `tests/test_complexity.py` for every misread solution. Branch's side is `modules/analysis/`: `analyzer.ts` (the `Analyzer` interface; never call the service elsewhere), `service.ts` (`runAnalysisJobs`: SKIP LOCKED claims, 3 attempts, 100 per person per day, cache by normalized code hash + language + problem + version; `deleteUnusedResults`), `trigger.ts` (`analyzeAfterResponse`, after a sync or paste), `actions.ts` (`checkAnalysesAction`, which Your solutions calls on open and compares by `analysisState` fingerprint). Analysis is off without `ANALYZER_URL`/`ANALYZER_SECRET`. Estimates are private, shown as "probably" (or "at most") with confidence, reasons, and limits, and never feed review or suggestions. Your solutions has its own tab (`/solutions`); `profile.analyzeSolutions` (Settings → Code analysis) turns analysis off and deletes estimates. Code or analysis reaches a group only through `shareSolution` (`modules/integrations/share.ts`), which the person triggers per solution, choosing the group and whether to include the code (then a spoiler), or through `profile.attachSolutions` ("Add my code to my solve posts", M23): `syncAutomaticPosts`/`announceResolve` link the synced submission (`post.submissionId`, composite FK to the author's own submission, `NoAction`, so every submission delete goes through `deleteSubmissions`, which unlinks first) only with the setting on and code within `POST_BODY_MAX`, and feed reads show it only while the setting is still on (`toFeedItem`). Never attach analysis to posts. Pasted solutions are submissions with source `PASTED` (no external ID), only for solved problems, and don't change completion. The E2E web servers include the real analyzer.
- **Study sessions** live in `modules/study/`: `duration.ts` (pure: 4-hour cap, 1-minute minimum, wording), `service.ts` (`startSession`, `stopSession`, `decideSession`, `deleteSession`, `setStudySharing`, each with `now`), `components/study/study-timer.tsx` (Home's orange button above "Your week"; the ticking time is `aria-hidden` and outside the button, so its name stays "Start/Stop studying"). Sessions are private; a session reaches a group only as a `STUDY` post (composite FK to the author's own session, cascade; optional note ≤ 500) made when the person shares it or by their remembered `profile.studySharing` (ASK, GROUP + `studyShareGroupId`, NEVER), checked against membership each time. A session that hit the cap (`autoStopped`) is never shared without asking. One running session per person and the 4-hour limit are database rules. `STUDY` posts are deleted by their author or the admin, never hidden or edited.
- **Changelog:** every update people can see adds an entry at the top of `CHANGELOG` (`apps/web/src/modules/changelog/entries.ts`) in the same commit: a permanent ID (`YYYY-MM-DD-slug`, CHECK on `profile.changelogSeenId`), the date it ships, a title, a one-line `summary` for Home's card (≤ 120 characters), and Markdown `details` for its page, in plain language for the people using Branch. No other parties' list names. `/changelog` and `/changelog/[id]` are public; Home's "What's new" card (`whatsNewFor`) shows entries after the one the person dismissed and after the day they joined.
- **Badges** live in `modules/badges/service.ts`: milestones only (no streaks), kept once earned (`badge_award`), awarded by `syncBadges` when shown. Groups see them only for members with `shareSolves` on (`badgesForGroup`), and never `REVIEWS_25` (reviews are private).
- **Group authorization** lives in `modules/groups/access.ts` (`requireMembership`, `requireAdmin`). Every group-scoped service function calls one of them first.
- **Module shape:** `apps/web/src/modules/<domain>/` holds `schemas.ts` (Zod), `service.ts` (server-only domain logic and authorization), `actions.ts` (server actions returning `FormState`), and colocated `*.test.ts` / `*.int.test.ts`.
- **UI pieces to reuse:** `ConfirmAction` (dialog that runs a server action), `CopyField`, `FormField`, `SettingsSection`, `MemberList`, `ProblemRow` (with a `leading` slot for `CompletionToggle`), `ProgressBar`. Style links as buttons with `buttonVariants()` (it merges classes so variants override the base).
- **Focus never falls to the page body.** `SubmitButton` is never natively disabled (it is `aria-disabled` while pending). Anything that swaps a control out returns focus deliberately; an action that removes its own item passes `focusAfterRemoval` to `ConfirmAction`, and a page that would 404 after the action passes `returnTo`.
- **Accessibility checks beyond axe:** `e2e/keyboard.spec.ts` covers keyboard operation, focus return, 320px reflow, and text spacing. Add new pages to its reflow list and to the axe scans in `e2e/accessibility.spec.ts`. Avoid fixed heights on rows that hold text.
- **Tests:** unit tests need no database; `*.int.test.ts` run against `TEST_DATABASE_URL`, which is reset before each test; E2E creates a fresh account per test through the `viewer` fixture, with `anotherUser()` and `createGroupInDb()` for multi-person scenarios and `createPlanInDb()` / `mondayWeeksAgo()` for scheduled groups (`apps/web/e2e/support/fixtures.ts`). Scope `alert`/`status` locators to `main` (Next's route announcer is also an alert), and wait for a hydration signal before clicking client controls. The reset helper refuses any database not ending in `_test`.
- **Design system:** tokens in `apps/web/src/app/globals.css`. Orange marks progress data, the logo, and focus only; never buttons, tabs, or nav (one owner exception, approved 2026-11-09: the study timer button on Home, with dark text for contrast). The primary action is an inverted pill. Elevation is a lightness step, not borders or shadows. Every text colour must hold 4.5:1 and control outlines 3:1 in both themes; don't dim content with `opacity` (it silently breaks contrast).
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
- `Post`, `Activity` (auto/manual semantics), `Comment` (parent ID), `Reaction`
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
3. Manual posts: text/Markdown, syntax-highlighted code, help requests, spoiler controls (no image uploads: owner decision).
4. Reactions, two-level threaded comments, delete/edit controls, basic abuse limits.
5. Tests: cross-group isolation, disabled auto-sharing, repeated submission, Markdown sanitization, comment permissions.

**Done when:** Members can post questions with code, react/reply, and see only authorized group activity.

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
4. Verify free-tier terms/limits and write a scaling runbook for database, queue, and realtime upgrades.

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

Phase 4 (review and analysis) is complete (M19–M22, summary reported to the owner). Next, once the owner approves their plan, and before Phase 5, come the owner's additions of 2026-11-09 (solutions on solve posts as an opt-in setting, study and problem timers, private personal statistics; `docs/DECISIONS.md`). Their plan (M23–M27) is approved in `docs/PLAN-ADDITIONS.md` (owner decisions there and in `docs/DECISIONS.md`); M23–M25 are done (extension 1.2.0 goes to the Chrome Web Store from the owner's account, `docs/CHROME-WEB-STORE.md` step 9); next is M26 (stats). The analyzer's Vercel project is created by the owner (`docs/DEPLOY.md`, "Code analyzer"). Any milestone with a migration must be applied to production (`DATABASE_URL=<direct> pnpm db:deploy`, by the owner) before it is pushed. Ask before starting Phase 5 (chat); reporting and blocking need their own approval.
