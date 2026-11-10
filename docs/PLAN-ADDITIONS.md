# Plan: the owner's additions before Phase 5

**Status: approved by the owner (2026-11-09), with the decisions below.** The decisions are also
recorded in `docs/DECISIONS.md` ("Plan for the additions approved").

The owner asked for three things on 2026-11-09 (`docs/DECISIONS.md`, "Owner requests"): solutions
on solve posts as an opt-in setting, a study timer and an extension problem timer, and private
personal statistics. This plan turns that into five milestones, built and checked one at a time
like M19–M22, before Phase 5 (chat). Nothing here needs paid infrastructure: everything runs on
the existing Vercel and Neon free plans, with no new services.

| Milestone                         | What people get                                                                              | Migration | Extension update          |
| --------------------------------- | -------------------------------------------------------------------------------------------- | --------- | ------------------------- |
| M23 Solutions on solve posts      | A setting that puts your code (as a spoiler) on your automatic solve posts                   | Yes       | No                        |
| M24 Study sessions                | A study timer on Home; each session can be shared to a group                                 | Yes       | No                        |
| M25 Problem timer                 | The extension times each problem and shows it on its toolbar button, with an optional budget | Yes       | Yes (1.2.0, store review) |
| M26 Your stats                    | A private page of your progress over time                                                    | No        | No                        |
| M27 Journeys, accessibility, docs | End-to-end tests, accessibility pass, docs, summary                                          | No        | No                        |

M26 comes after the timers because it shows their data. Every migration is applied to production
by the owner (`DATABASE_URL=<direct> pnpm db:deploy`) before its milestone is pushed.

## Owner decisions (2026-11-09)

1. **Turning code on posts off later (M23):** the setting decides at read time, so turning it off
   takes the code off every past solve post too, and deleting a solution takes it off its post.
2. **The study timer (M24)** is an orange button above "Your week" on Home. This is an owner
   exception to the design rule that orange is never used for buttons; it applies to this button
   only, and its text must still hold 4.5:1 contrast in both themes (dark text on orange). No
   indicator elsewhere.
3. **A forgotten timer (M24)** stops counting at 4 hours: a session found still running after that
   is saved as 4 hours and marked "stopped automatically". Sessions can be deleted, not edited.
4. **A study session is tied to nothing** (no group, no problem); it's time studied.
5. **The problem timer (M25)** counts the time the problem's tab was visible, from first opening it
   in that tab until an accepted submission, pausing while you're in another tab or window.
6. **The time budget (M25)** is one optional number, set in the extension's popup and kept in the
   extension. Past it, the toolbar button turns to a warning colour and the popup says so; no
   sound, pop-up, or notification.
7. **Stats (M26)** live at `/stats`, linked from Home's weekly summary and from Review, with no
   new tab. The owner may move them later, so the page shouldn't depend on where it's linked from.
8. **Groups see study sessions one at a time, by choice (M24):** stopping a session offers "Share
   to a group" (pick the group, optional note), with "Remember my decision". Remembering makes
   later sessions follow the same choice without asking: always share to that group, or never
   share. Settings shows the remembered choice and can switch back to asking each time. There are
   no weekly totals on the group page, and nothing sorts or compares people by time.

## M23 — Solutions on solve posts

**Behaviour**

- Settings → Sharing gets "Add my code to my solve posts" (off by default, and only usable while
  "Share my solves" is on). The help text says that group members will see the code, folded as a
  spoiler.
- When a synced submission creates a "Solved" post (`SOLVE`, from `ingestSubmission` or from
  `matchWaitingSubmissions` once a waiting slug arrives), the post links that submission. A
  "Solved it again" post (`RESOLVE`) links the new submission. Manual and pasted solves have no
  synced code, so nothing is attached.
- The card shows the code folded as a spoiler, with its language, the same way a shared solution
  shows it. No complexity estimate.
- Code longer than a post allows (`POST_BODY_MAX`, 5,000 characters) isn't attached, so feed pages
  stay small; Settings explains this. The person can still share it by hand from Solutions.
- Decision 1: the code shows only while the author's setting is on and the submission still
  exists.

**Schema** (migration `solve_post_code`)

- `profile.attachSolutions Boolean @default(false)`.
- `post.submissionId uuid NULL`, with a composite foreign key `(submissionId, authorId)` →
  `submission(id, userId)` `ON DELETE SET NULL (submissionId)`, so a post can only link its own
  author's submission. (A column list on SET NULL needs Postgres 15 or later; local runs 18, and
  production's backups already need `pg_dump` 17. Prisma can't express it, so it goes in the
  migration SQL with an integration test, per the repo rules.)
- CHECK: `submissionId IS NULL OR kind IN ('SOLVE', 'RESOLVE')`.

**Code:** `modules/feed/automatic.ts` (`syncAutomaticPosts` and `announceResolve` take an optional
submission ID), `modules/integrations/submissions.ts` (pass it), the feed and post queries
(select the submission only when the author's setting is on), `components/feed/` (the folded code
block, reusing the Markdown renderer's highlighting), `modules/profile/` (setting, schema,
action), the Settings page.

**Tests**

- Integration: off by default, nothing attached; on, a sync attaches its submission to SOLVE, a
  re-solve to RESOLVE; manual solves attach nothing; a post can't link someone else's submission
  (the database refuses); code over the limit isn't attached; turning the setting off hides the
  code at once; deleting the solution unlinks it; a non-member still gets a 404.
- E2E: a groupmate sees the code only after opening the spoiler, and stops seeing it when the
  setting goes off.
- Docs: `/privacy`, the PRD note, `docs/DECISIONS.md`.

## M24 — Study sessions

**Behaviour**

- Home shows an orange "Start studying" button above "Your week" (decision 2). While a session
  runs it reads "Stop · 0:42", counted from the server's start time, so it survives reloads, tabs,
  and devices. One session runs at a time.
- Stopping saves the session and, unless a decision is remembered, asks whether to share it:
  "Share to a group" (group, optional note) or "Don't share", with "Remember my decision"
  (decision 8). A shared session is a post in that group, "Studied for 45 min" with the note,
  which its author can delete like any post. Nothing about a session reaches a group otherwise.
- A remembered "share to this group" posts each finished session there without asking (no note).
  If the person has left that group, Branch asks again. Settings → Sharing shows the remembered
  choice ("Ask each time", "Always share to …", "Never share") and can change it.
- A session left running stops counting at 4 hours (decision 3) and isn't shared automatically
  then: the person is asked when they come back, even with a remembered choice, since the time is
  a guess. Sessions can be deleted, which also deletes posts made from them.

**Schema** (migration `study_sessions`)

- `study_session`: `id`, `userId` (cascade), `startedAt`, `endedAt NULL`, `autoStopped Boolean`.
  A partial unique index allows one open session per user. A CHECK requires an ended session to
  end after it started and within 4 hours of it. Index `(userId, startedAt)`.
- `post`: a new kind `STUDY`, and `studySessionId uuid NULL` with a composite foreign key
  `(studySessionId, authorId)` → `study_session(id, userId)` `ON DELETE CASCADE`, so a post can
  only share its author's own session and goes with it. A CHECK sets `studySessionId` exactly for
  `STUDY` posts, whose note (`body`) is optional. One post per session and group (unique).
- `profile.studySharing` (`ASK` by default, `GROUP`, or `NEVER`) and `profile.studyShareGroupId`
  (nullable, `ON DELETE SET NULL`); a CHECK sets the group exactly when sharing is `GROUP`. Sharing
  checks membership each time, so a group the person left falls back to asking.

**Code:** a new `modules/study/` (`service.ts`: `startSession`, `stopSession`, `shareSession`,
`deleteSession`, each with a `now` argument; `actions.ts`), `components/study/` (the button, a
client component ticking once a second with no live announcement of the ticking, and the share
dialog after stopping, with the same focus handling as `ConfirmAction`), Home's weekly summary,
the feed card for `STUDY` posts, Settings → Sharing.

**Tests**

- Unit: the 4-hour cap; the duration wording.
- Integration: one open session at a time (database); stopping, sharing, or deleting someone
  else's session is a 404; sharing needs membership of the group; a post can't share someone
  else's session (database); a remembered group shares without asking, falls back to asking after
  leaving it, and "never" shares nothing; an auto-stopped session is never shared automatically;
  deleting a session deletes its posts.
- E2E: start, reload, still running, stop, share with a note; a groupmate sees "Studied for …";
  "Remember my decision" then a second session posts by itself; Settings switches back to asking;
  keyboard operation and focus after the dialog; axe scan; 320px reflow; the button's contrast in
  both themes.

## M25 — The extension's problem timer

**Behaviour**

- On a problem page (leetcode.com `/problems/<slug>/`, and neetcode.io's problem pages) the
  extension starts a timer for that tab, counting while the tab is visible (decision 5). The
  toolbar button shows the minutes ("12m") for that tab; it turns to the warning colour past the
  budget (decision 6). Accepted, it stops, and the time is sent with the submission.
- The popup shows the current problem's time and the budget setting.
- Branch shows the time on the solution in Solutions ("Solved in 24 min"), and nowhere a group can
  see.

**What changes for the store:** the extension now reads which problem page a tab is on and whether
it's visible, and sends the time spent with each accepted submission. Nothing is sent for problems
not accepted, and the coding sites' pages are still never changed or called. So, together:
`EXTENSION_DISCLOSURE`, `/privacy`, `docs/CHROME-WEB-STORE.md` (data-use answers and listing
text), version 1.2.0, and the owner resubmits it for review. No new permissions: the toolbar
badge needs none. Until people update, 1.1.0 keeps working (the field is optional).

**Schema** (migration `submission_time_spent`): `submission.timeSpentSeconds Int NULL`, CHECK
`timeSpentSeconds IS NULL OR timeSpentSeconds BETWEEN 1 AND 86400`.

**Code:** `@branch/shared/extension` (optional `timeSpentSeconds` in the contract), a new pure
`apps/extension/src/timer.ts` (visible-time accounting per tab, unit-tested with a fake clock), the
observers or site relay (page and visibility signals), `background.ts` (per-tab timers in
`storage.session`, the badge), the popup, `modules/integrations/submissions.ts` (store it), the
Solutions card.

**Tests**

- Unit: the timer pauses when hidden, resumes, resets on accept, and keeps tabs apart; the budget
  colour; old payloads without the field still parse.
- Integration: the time is stored, out-of-range values are refused, a duplicate keeps the first.
- Real-extension E2E: open a stubbed problem page, wait, submit, accepted; Branch shows the time;
  the badge text.

## M26 — Your stats

A private page (`/stats`, decision 7), derived on each read like reviews; nothing is stored.
Charts are plain server-rendered HTML/SVG with a table behind each one for screen readers; no
chart library.

- **Solving:** total solved, by difficulty, and solves per week for the last 12 weeks.
- **Topics:** solved per topic, with the topics Review currently suggests practising (already
  private to you).
- **Reviews:** reviews done in the last 30 days and how they went.
- **Time:** study time per week for the last 12 weeks (M24), and the typical (median) time per
  problem by difficulty from the extension timer (M25), with how many solves it's based on.
- No streaks (as decided for badges), no rankings, no comparison with anyone.

**Code:** a new `modules/stats/` (pure aggregation functions plus bounded queries: counts grouped
in SQL, never every row), `app/(app)/stats/`, links from the weekly summary and Review.

**Tests:** unit (week bucketing in the person's timezone, medians with few samples); integration
(someone else's stats can't be read; empty states); E2E (the page with seeded data, axe scan,
320px reflow, text spacing).

## M27 — Journeys, accessibility, and docs

A journey across all four: study and share the session, solve with the extension timer running,
see the code on the solve post as a groupmate, read the stats. Keyboard and screen-reader pass
over the timer controls (the ticking time must not be announced every second). README, `/privacy`,
`docs/DEPLOY.md` (nothing new to configure is expected), the summary in `docs/DECISIONS.md`, and
CLAUDE.md. Then stop and ask before Phase 5.

## Risks and limits

- **Store review (M25)** can take days and can ask for changes; Branch's side ships first and
  works with 1.1.0 meanwhile.
- **LeetCode or neetcode.io redesigns** could break the problem-page signal; the timer then shows
  nothing, and syncing is unaffected (it uses separate signals).
- **Timer accuracy:** a timer in a browser that's asleep or closed doesn't count; times are
  labelled as approximate.
- **Study time can't be verified**; it's self-reported by starting the timer, which is why it's
  shared only by choice and nothing ranks it.
