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

## Known limitations

- Phase 1 has no email delivery, so there is no email verification or password reset.
- ESLint 9 is end-of-life upstream (see dependency choices).
- No CI pipeline yet; checks run locally.
