# Plan: M32 — schools and companies

**Status (2026-11-17): approved by the owner and done.** Decisions are also in
`docs/DECISIONS.md`.

People may add the school they attend and the company they work for. Branch adds their solves to
that school's or company's totals on a Rankings page, without their name, and shows the school
and company to people in their groups only if they turn that on. Individuals are never ranked;
each person's own numbers stay on Your stats.

This is personal data: a school or employer tied to an account is personal information under
California law. It's stored on the profile, shown to nobody by default, and deleted when the
person removes it. `/privacy` says so.

## Owner decisions (2026-11-17)

1. **Ranking:** total problems solved by members, with a per-member average beside it.
2. **Period:** this month only, so rankings keep changing. Each person's solves count in their own
   time zone's month.
3. **Minimum size:** a school or company appears only once at least 5 people have chosen it (so
   totals never reveal one person). Applied to companies too.
4. **Counting:** choosing a school or company counts you toward it; no separate switch.
5. **Companies:** a fixed list of big names, no requests. Schools come from Hipo's
   university-domains-list (MIT), with a short alias list for abbreviations.
6. **Who sees rankings:** signed-in people only.
7. **Groups:** one switch, "Show my school and company to my groups", off by default.

## What's built

| Area     | Change                                                                                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data     | `prisma/data/organizations/` (`schools.json` built from Hipo by `build-schools.ts`, `school-aliases.json`, `companies.json`); contracts in `@branch/shared/organizations`; `pnpm db:load-organizations` (idempotent, never deletes) |
| Database | `organization` (id `school:<domain>` or `company:<slug>`, kind, name, country, aliases); `profile.schoolId`, `profile.companyId`, `profile.showAffiliation`; CHECKs tie each id to its kind                                         |
| Settings | "School and company": a search box for each, the group switch, a rate limit on saving                                                                                                                                               |
| Rankings | `/rankings` (signed in): schools and companies, this month, top 50, the viewer's own standing; linked from Your stats                                                                                                               |
| Groups   | Member lists show a member's school and company when they've turned the switch on                                                                                                                                                   |
| Docs     | `/privacy`, `/terms`, the changelog, `SOURCES.md`, `DEPLOY.md`, `ACCEPTANCE.md`                                                                                                                                                     |

Totals are derived on every read and never stored, so removing a school removes your share at
once. Choices aren't verified (Branch sends no email), so the page says "self-reported".

## Deploying

The migration first (`DATABASE_URL=<direct> pnpm db:deploy`), then the lists
(`DATABASE_URL=<direct> pnpm db:load-organizations`), then push.
