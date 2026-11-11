# Acceptance scenarios

The PRD's acceptance scenarios (§9), and those added since, each mapped to the browser tests that
prove it. `pnpm test:acceptance` runs exactly these tests (both projects, desktop and mobile);
`apps/web/src/test/acceptance-map.test.ts` fails if a test named here is renamed or removed, so
the map can't go stale. Integration tests cover the same rules underneath; they aren't listed.

Each test line is `` `e2e/<file>` › "<exact test title>" ``.

## 1. Two friends join one invite-only group and see the same current-week problems

- `e2e/journey.spec.ts` › "two friends share a weekly plan and track their own progress"
- `e2e/groups.spec.ts` › "two friends join one invite-only group"

## 2. A missed week stays incomplete while the group advances

- `e2e/progress.spec.ts` › "unsolved problems stay in the backlog as the weeks move on"

## 3. A problem in two roadmaps: both progress views update, with one canonical completion

- `e2e/progress.spec.ts` › "one completion counts in every group that assigns the problem"

## 4. A help post with code marked as a spoiler gets threaded replies

- `e2e/comments.spec.ts` › "a help post with spoiler code gets reactions and threaded replies"
- `e2e/feed.spec.ts` › "a spoiler post folds its highlighted code until a reader opens it"

## 5. A non-member can't reach private group activity through the feed, URLs, or APIs

- `e2e/privacy.spec.ts` › "outsiders and former members see nothing of a group's activity"
- `e2e/groups.spec.ts` › "non-members cannot reach a group by URL"
- `e2e/feed.spec.ts` › "members see each other's posts; outsiders see nothing"

## 6. With auto-sharing off, a completion updates progress but posts nothing

- `e2e/sharing.spec.ts` › "a solve posts nothing while sharing is off, the default"

## 7. Re-submitting never makes a second completion or a duplicate solve post

- `e2e/sharing.spec.ts` › "with sharing on, a solve posts once; undo withdraws it and hiding is for good"
- `e2e/sharing.spec.ts` › "marking the same problem solved from two tabs posts once"
- `e2e/review-journey.spec.ts` › "a synced solve is analyzed, reviewed, and turned into suggestions, all in private"

## 8. Without the extension, someone can track problems and use everything social

- `e2e/journey.spec.ts` › "two friends share a weekly plan and track their own progress"
- `e2e/progress.spec.ts` › "a member marks a problem solved and the group sees it"

## 9. An uncertain analysis is labelled as such and never exposes code to others

- `e2e/analysis.spec.ts` › "a pasted solution gets an estimate, shown as an estimate"
- `e2e/analysis.spec.ts` › "a solution is shared only when its owner chooses, to the group they choose"
- `e2e/review-journey.spec.ts` › "a synced solve is analyzed, reviewed, and turned into suggestions, all in private"

## 10. The theme follows the system by default, and an override persists

- `e2e/appearance.spec.ts` › "follows the system preference by default"
- `e2e/appearance.spec.ts` › "an explicit choice overrides the system and persists across reloads"

## 11. The app identifies itself as Branch

- `e2e/smoke.spec.ts` › "identifies the product as Branch"

## 12. Reporting and blocking (Phase 5, owner decisions 2026-11-09)

- `e2e/moderation.spec.ts` › "a member reports a post, the admin removes it"
- `e2e/moderation.spec.ts` › "the admin can keep a reported post up instead"
- `e2e/moderation.spec.ts` › "blocking hides someone's posts and stops their replies, until unblocked"

## 13. Hardening: security headers, request IDs, and pages without CSP violations (Phase 5)

- `e2e/hardening.spec.ts` › "responses carry the headers, and a fresh request ID each"
- `e2e/hardening.spec.ts` › "the pages people use run without CSP violations"

## Not yet

- **Group chat** (M28, on hold): its scenarios join this map when it's built.
