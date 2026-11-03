# Architecture decisions and milestone log

Implementation notes for Branch. Product behavior is defined in [PRD.md](../PRD.md); engineering
conventions in [CLAUDE.md](../CLAUDE.md). This file records how those were applied and why.

## Approved Phase 1 decisions (2026-11-03)

| Topic                     | Decision                                                                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Curated roadmaps          | Seed ~25 well-known problems (slug, title, difficulty only; no problem text) and a clearly labeled sample roadmap. Build a validated JSON importer. Draft NeetCode 150 / Blind 75 / Grind 75 from public sources with citations for owner review before anything is marked curated. |
| Authentication            | Better Auth email + password (no verification or reset emails in Phase 1) plus optional GitHub OAuth when configured. Email sending sits behind an adapter that logs to the console until a provider is chosen.                                                                     |
| Group progress visibility | Members see each other's status on the group's **assigned** problems only. Completions outside the plan and any review or weakness data stay private.                                                                                                                               |
| User-added problems       | Users may add a problem by LeetCode URL; the slug is deduplicated, title and difficulty are user-entered, and the record is marked `source: USER`.                                                                                                                                  |
| Admin model               | Exactly one admin per group, enforced by a partial unique index; transfer is a single transaction.                                                                                                                                                                                  |
| Invites                   | Link-based (no email). Tokens are stored hashed, with expiry, optional use limit, and revocation.                                                                                                                                                                                   |
| Calendar                  | Weeks are computed from the plan's start date and IANA timezone at request time; no scheduler. Week starts Monday by default.                                                                                                                                                       |
| Navigation                | The Review tab stays hidden until Phase 4; Phase 1 Home shows this week, backlog, and progress (the feed arrives in Phase 2).                                                                                                                                                       |
| 21st.dev                  | No API key or MCP. Used only as visual reference; components are built on shadcn/ui and Branch tokens.                                                                                                                                                                              |
| Repository                | Docs live at the root. Commit at the end of each milestone and push `main` to GitHub.                                                                                                                                                                                               |

## Dependency choices

| Choice                   | Reason                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript 6.0, not 7.0  | `typescript-eslint` supports TypeScript `<6.1`.                                                                                                                                                                                                                                                                           |
| Prisma 7.10, not 8.0     | npm's `latest` tag points at an 8.0 release candidate, and Better Auth supports Prisma `^5–^7`.                                                                                                                                                                                                                           |
| ESLint 9.39              | `eslint-config-next` depends on React, a11y, and import plugins that support ESLint `<=9`. ESLint 9 is marked deprecated upstream; upgrade once those plugins support 10.                                                                                                                                                 |
| No `vite-tsconfig-paths` | Vite 8 (via Vitest 5) resolves tsconfig paths natively.                                                                                                                                                                                                                                                                   |
| Single root `.env`       | Loaded with Node's `process.loadEnvFile` in the Next, Prisma, and Playwright configs. Variables already set in the environment take precedence, which is how E2E runs point the app at `TEST_DATABASE_URL`. (`@next/env`'s `loadEnvConfig` caches its first call, so it cannot load the root file from `next.config.ts`.) |

## Design tooling: taste skill

The `design-taste-frontend` skill ([Leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill))
is installed in `.claude/skills/`, copied and pinned in `skills-lock.json`.

The installer's security scan rated it Critical (Gen Agent Trust Hub) and Medium (Snyk); Socket
reported no alerts. A review on 2026-11-03 found:

- The "malware" flag is on `library/sites.json`, a plain JSON list of 202 design-gallery sites with
  no executable content. Two of its URLs appear on threat blocklists; no script fetches them.
- `scripts/lib/cdp.mjs` spawns headless Chrome for screenshots.
- `scripts/assets.mjs` fetches metadata from public image archives (indirect prompt-injection risk).

How Branch uses it: only its app-screen guidance plus `lint.mjs` and `inspect.mjs --app`, pointed
at our own localhost. `assets.mjs` is not run, its gallery links are not followed, and its
GSAP/Lenis CDN recommendations are not adopted. Where its landing-page rules (heavy motion, imagery
floors) conflict with the PRD's restraint, the PRD wins.

## Design system

Tokens live in `apps/web/src/app/globals.css`. Branch's semantic names (`ground`, `surface`,
`raised`, `line`, `control`, `ink`, `ink-muted`, `ink-faint`, `brand`, status pairs) are the
source of truth; shadcn/ui's variable contract (`--background`, `--primary`, ...) is mapped onto
them so generated components stay compatible. Components use the Base UI primitives (shadcn
`base-nova`).

The taste skill dealt the `true-black-flat` app style (seed 518019275, kind `community`, dark),
applied with Branch's brand palette kept:

| Rule                   | Application                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elevation by lightness | Ground `#17191D` → surface `#1E2125` → raised `#262A30`. Dark cards have no border or shadow; only floating layers get `--shadow-float`.                 |
| Colour on data only    | Orange (`#FF683B` dark, `#D9480F` light) marks progress data, the logo, and the focus ring. It never fills buttons, tabs, or navigation.                 |
| Inverted primary       | The one primary action per screen is an inverted pill (light on dark, near-black on light).                                                              |
| Navigation             | Dark: the active label brightens. Light: a neutral grey pill.                                                                                            |
| Type                   | Geist, one family (400/500/600). Body 14px, titles 24px/600, tabular figures via the `tabular` utility. Geist Mono is added with code blocks in Phase 2. |
| Radius                 | Cards 16px, nested panels and inputs 10px, controls full pills.                                                                                          |

Deviations from the sheet, with reasons:

- **Charcoal, not true black.** The PRD fixes a charcoal canvas; it is a cool near-black, which the
  sheet allows as "a ground with the product's temperature".
- **Geist, not the dealt Inter.** The product brief names Vercel's typography as a reference.
- **Shell redrawn to the "open plane" (no 64px top bar with a scope switcher).** Branch's Home is a
  union of all the viewer's groups (PRD §4), so a global group switcher would wrongly scope the
  whole app. Desktop uses a labelled sidebar and the PRD's right rail; mobile uses a compact header
  and a bottom bar.
- **Planned signature element (M7):** a git-style branch graph, with the group's calendar as the
  main line and each member's progress branching ahead of or behind it.

Contrast was computed for every text and data colour against every surface in its theme: all text
is at least 4.5:1, control outlines at least 3:1 (WCAG 1.4.11), and the light-mode orange 3:1 as a
graphic. Re-check after changing any token.

## Authentication and profiles

- **Better Auth owns** `user`, `session`, `account`, `verification`, and `rateLimit` (generated with
  `npx auth@1.7.15 generate`). **Branch owns** `profile` (username, bio, timezone, appearance), so
  domain data never depends on the auth vendor's tables.
- **Authorization root:** `requireViewer()` validates the session against the database and requires
  a profile; every app page and server action starts there. User IDs are never accepted from the
  client.
- **Proxy is optimistic only.** `src/proxy.ts` redirects requests with no session cookie to
  `/sign-in?next=...` and forwards the path so server code can return users after sign-in. Return
  paths pass through `safeNextPath()` to prevent open redirects.
- **Usernames** are stored lowercase, so uniqueness is case-insensitive; the format and bio length
  are also database CHECK constraints.
- **Rate limiting** uses Better Auth's database storage (5 attempts per minute on sign-in, sign-up,
  and password change), enabled in production.
- **Appearance** is saved to the profile and applied on other devices after sign-in.
- **Password change** revokes other sessions and confirms via a URL parameter, because the rotated
  session cookie re-renders the page and would discard client-side form state.

## Domain schema

- **IDs:** domain tables use UUIDv7 (`@default(uuid(7))`, time-ordered for index locality); auth
  tables keep Better Auth's text IDs.
- **Canonical problems** are independent of roadmaps and store identifiers and metadata only
  (LeetCode slug, title, difficulty, pattern tags); the URL is derived from the slug.
- **Roadmaps** have versions. A version is a draft (at most one per roadmap) or published.
  Published versions are immutable, enforced by triggers on sections and items and on the version
  row itself. Groups attach to a published version, so editing a roadmap never rewrites a group's
  plan.
- **Plans:** week _n_ runs from `startDate + 7(n−1)` days in the group's timezone, so there is no
  separate week-start setting that could disagree with the start date (the UI will suggest the
  next Monday). Timezone lives on the group, as the PRD recommends. At most one active plan per
  group; replacing a plan archives the old one.
- **Weekly assignments** carry the plan's version ID and reference both the plan and the roadmap
  item by composite foreign keys, so a plan can only schedule items from its own version.
- **Completions:** one row per user and problem (unique), shared by every group and roadmap. The
  external submission ID belongs to the `Submission` table that arrives with the extension in
  Phase 3.
- **Deletion:** removing a user cascades their memberships, profile, and completions, and nulls
  authorship fields; a roadmap version used by any plan cannot be deleted.

## Groups and invites

- **Privacy:** non-members get a 404 (with a real 404 status) for group pages, settings, and every
  group action; members get a 404 for admin-only pages and a clear "only the admin" message for
  admin-only actions. Malformed IDs are treated as not found.
- **Loading boundaries:** a route-level `loading.tsx` makes Next stream with status 200 before the
  page can call `notFound()`, so only `home/` has one. Pages that can 404 render fully first.
- **Invites:** 256-bit random tokens, stored only as SHA-256 hashes, so a link is shown once when
  created (copy it then). Expiry of 1, 7, or 30 days; optional use limit of 1, 5, 10, or 25; can be
  turned off. Joining is idempotent for existing members, and claiming a use is a single
  conditional update, so a limited link cannot be over-used by concurrent joins. Admins can create
  at most 20 links per group per hour. Invite pages are `noindex`.
- **Admin role:** transfer demotes the current admin and promotes the target in one transaction,
  re-checking the role inside it, so concurrent transfers still leave exactly one admin. The admin
  cannot leave or be removed; they transfer first, or delete the group if they are the only
  member.
- **Audit:** group creation and updates, joins, leaves, removals, admin transfers, and invite
  creation and revocation are recorded and shown to the admin as "Admin activity". Deleting a group
  removes its audit trail with it, so deletion is also written to the server log.

## Roadmaps

- **Who sees what:** curated roadmaps are visible to every signed-in user. A custom roadmap is
  visible to its owner, to members of any group whose plan uses one of its versions, and to anyone
  signed in who holds its share link (through the share URL only). Everyone else gets a 404.
  Drafts are visible only to the owner.
- **Editing model:** a roadmap has at most one draft. "Edit" copies the latest published version
  into a draft; saving replaces the draft's content in one transaction; publishing validates it
  (at least one section, no empty sections, no duplicate problems, at most 50 sections and 500
  problems) and freezes it as the next version. Groups keep the version they attached to.
- **Editor accessibility:** reordering uses "move up / move down" buttons rather than
  drag-and-drop, so it works by keyboard and screen reader. Add buttons keep their visible word at
  the start of the accessible name (WCAG 2.5.3).
- **Adding problems by link:** only `leetcode.com` / `leetcode.cn` `/problems/<slug>` URLs (or a
  bare slug) are accepted. Unknown problems are added to the shared catalog as `source: USER` with
  the title and difficulty the user enters; at most 50 per person per day.
- **Sharing:** link sharing uses a 192-bit random token shown in the roadmap's settings; turning it
  off invalidates the link. Share pages require sign-in and are `noindex`.
- **Deletion:** a roadmap can be deleted only while no group's plan uses any of its versions.

## Curated lists

- NeetCode 150 and Blind 75 are drafted in `packages/database/prisma/data/curated-drafts/` from
  `neetcode-gh/leetcode`'s `.problemSiteData.json` (MIT), pinned to a commit and cited on each
  roadmap. Only identifiers and metadata were taken. They are not imported until the owner
  approves; the README there lists what to check (title casing, seven Premium problems, naming).
- Cross-check: every seed problem that appears in NeetCode 150 has the same difficulty in both
  sources; three titles differ only in capitalization.
- **Grind 75 is not drafted:** there is no openly licensed, machine-readable source (the Tech
  Interview Handbook repo only proxies to a separately hosted site).
- `pnpm db:import-curated` imports approved files into any environment, refuses `curated-drafts/`
  without `--allow-draft`, and is idempotent.

## Milestone log

### M0 — Workspace and tooling (complete)

- pnpm workspace: `apps/web` (Next.js 16.4, React 19.3, Tailwind 4.3) and `packages/database`
  (Prisma 7.10 with the `pg` driver adapter).
- Strict TypeScript (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), ESLint, Prettier.
- Vitest unit tests; Playwright E2E on desktop and mobile viewports against the test database.
- Docker Compose PostgreSQL 18 with separate `branch` and `branch_test` databases.
- Validated server environment, structured JSON logger, `GET /api/health`, baseline security
  headers, `X-Powered-By` disabled.

Verified: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (4 unit tests),
`pnpm build`, `pnpm test:e2e` (4 tests: title and heading, health endpoint, on desktop and mobile).

### M1 — Design system and app shell (complete)

- Semantic light and dark tokens, the Base UI button restyled to the system, shared skeleton,
  empty, and error states.
- Temporary original branch mark, `branch.` wordmark, SVG favicon, page metadata with the
  `%s · Branch` title template, theme-coloured browser chrome.
- Dark / Light / System appearance (default System, persisted per device with `next-themes`);
  account-level sync arrives with profiles in M2.
- Responsive shell: sidebar on desktop, header and bottom bar below 1024px, skip link, branded
  404 (also used for resources the viewer may not access), loading and error boundaries.
- Reduced motion collapses transitions and animations to 1ms; touch devices get 44px targets.
- Home, Roadmaps, Groups, and Profile currently render only their titles; their content arrives
  in M2–M7. The landing page becomes the sign-in entry point in M2.

Verified: 8 unit tests; 55 E2E tests on desktop and mobile (1 desktop-only test skipped on mobile),
including axe WCAG 2.2 A/AA scans of every route in both themes with no violations; theme default,
override, persistence, and keyboard control; navigation state; skip link; 404; reduced motion.
Taste-skill lint: 0 FAIL. Inspector on `/settings`: 0 FAIL, 2 WARN (empty canvas on a one-section
page, expected until more settings exist).

### M2 — Authentication and profiles (complete)

- Email and password sign-up and sign-in; optional GitHub OAuth when configured; sign-out.
- Onboarding: username (suggested from the name) and timezone (detected from the browser).
- Settings: profile (name, username, bio, timezone), appearance synced to the account, password
  change, sign-out. Profile page with identity, bio, and member-since date.
- Sidebar shows the signed-in person with a stable identity tint.
- Test infrastructure: Vitest `unit` and `integration` projects; integration and E2E runs migrate
  and empty the `_test` database; E2E creates a fresh account per test through Better Auth's API.

Verified: 45 unit tests; 10 integration tests (case-insensitive and concurrent username claims,
CHECK constraints with the application bypassed, transactional rollback, scoped updates); 97 E2E
tests on desktop and mobile, stable across three consecutive runs (sign-up through onboarding,
protected-route round trip, wrong password, duplicate email and username, open-redirect guard,
incomplete account sent to onboarding, profile edit, password change, sign-out, appearance synced
to a second browser, axe scans of every public and signed-in page in both themes). Taste-skill
lint: 0 FAIL.

### M3 — Domain schema and seed data (complete)

- Schema for groups, memberships, invites, audit events, problems and tags, roadmaps with
  versions, sections and items, group plans, weekly assignments, and completions, with the
  invariants above enforced in the database.
- `@branch/shared/catalog`: validated contracts for the problem catalog and roadmap definitions.
- `@branch/database/catalog-import`: idempotent catalog sync, and a curated-roadmap importer that
  publishes changed content as a new version.
- Idempotent dev seed: 31 well-known problems (identifiers and metadata only), a "Starter sample"
  roadmap labeled as a development sample, two dev accounts with real password hashes, and one
  group. Verified the seeded accounts sign in through Better Auth.

Verified: 7 shared-contract tests; 45 unit tests; 31 integration tests, including 21 new ones
covering each database invariant with the application bypassed, cascade deletion through the
immutability triggers, and importer versioning; 97 E2E tests; production build.

The seed catalog lists problems from memory of their public LeetCode identifiers; spot-check slugs
and difficulties before any public launch. Curated NeetCode 150 / Blind 75 / Grind 75 lists are
drafted for review in M5.

### M4 — Groups, membership, invites, and admin (complete)

- Groups list, create group, group page with members, and admin settings (details, invite links,
  member management, admin activity, delete group).
- Invite landing page for signed-out and signed-in visitors; new users sign up, finish onboarding,
  and return to the invite to join.
- Leave group, remove member, and transfer admin behind accessible confirmation dialogs; delete
  requires typing the group's name.
- Fixed: link-styled outline buttons lost their border because their classes were not merged.

Verified: 51 unit tests; 50 integration tests, including 19 for groups (privacy for non-members
and members, hashed tokens, invite states, concurrent joins on a single-use link, cross-group
revocation, invite rate limit, leave/remove/transfer rules, racing transfers keeping one admin,
delete confirmation and cascade); 121 E2E tests, stable across consecutive runs, including two
friends joining through an invite link from sign-up, 404 status for non-members and for members on
admin pages, removal, transfer, leaving, deletion, a turned-off link, and axe scans of every group
page and an open dialog in both themes. Taste-skill lint: 0 FAIL.

### M5 — Roadmaps (complete)

- Roadmaps page (yours, used by your groups, curated), roadmap view with version history and
  LeetCode links, custom roadmap creation, the draft editor (sections, catalog search, add by
  LeetCode link, keyboard reordering, save, publish, discard), settings (details, link sharing,
  delete), and the shared-link view.
- Curated NeetCode 150 and Blind 75 drafts with provenance, an import command, and data-file
  validation tests. Grind 75 deliberately not drafted.
- Mobile: scroll padding keeps focused elements clear of the sticky header and bottom bar.

Verified: 71 unit tests (LeetCode URL parsing, publish rules, all data files valid with the
expected 150/75 sizes and pinned sources); 66 integration tests, including 16 for roadmaps
(visibility for strangers, group members, and share links; drafts owner-only; version 2 leaving
version 1 intact; concurrent draft start; publish validation; delete blocked while in use;
catalog search; add by URL with deduplication under concurrency and a daily limit); 135 E2E tests
stable across consecutive runs (create → publish → revise with version history, draft save and
publish validation, private vs shared access with 404s, deletion, curated read-only, axe scans of
roadmap pages and the editor in both themes); curated import verified against the test database
(idempotent, refuses drafts without the flag). Taste-skill lint: 0 FAIL.

## Known limitations

- Phase 1 has no email delivery, so there is no email verification or password reset. Sign-up
  reveals whether an email is already registered; acceptable for invite-only groups of friends,
  to revisit before public sign-up.
- Accounts cannot yet be deleted from the UI.
- Problems have no Premium flag; Premium problems link to LeetCode like any other.
- User-added problems become part of the shared catalog with user-entered titles; there is no
  moderation of catalog edits yet.
- Other people's profile pages don't exist yet; members see each other's name and username in the
  group's member list only.
- ESLint 9 is end-of-life upstream (see dependency choices).
- No CI pipeline yet; checks run locally.
