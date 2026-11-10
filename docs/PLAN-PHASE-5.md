# Plan: Phase 5 — chat, reporting and blocking, and hardening

**Status (2026-11-10): M29 and M30 done, with decisions 3, 4, and 5 answered (below).
M28 (chat) is on hold while the owner works out the database side; decisions 1, 2, and 5 are
still open.** Answered decisions are also in `docs/DECISIONS.md`.

Phase 5 in the PRD is "Group chat, accessibility/performance refinements, deployment hardening",
done when "chat works with appropriate access control and the app is ready for broader rollout".
On 2026-11-09 the owner added reporting and blocking (deferred since 2026-11-04). Four
milestones, built and checked one at a time, then a summary and a stop:

| Milestone                             | What people get                                                          | Migration | New service |
| ------------------------------------- | ------------------------------------------------------------------------ | --------- | ----------- |
| M28 Group chat                        | A chat in each group, for its members only, with spoilers and moderation | Yes       | No          |
| M29 Reporting and blocking            | Report a post, comment, or message; block a person                       | Yes       | No          |
| M30 Hardening                         | Security headers, rate limits everywhere, error tracking, faster pages   | Maybe     | No          |
| M31 Rollout readiness, journeys, docs | Deployment checks, a scaling runbook, Phase 5 journeys, docs, summary    | No        | No          |

Everything stays on the Vercel and Neon free plans unless the owner chooses otherwise in
decision 1.

## What the free plans allow (docs/DEPLOY.md, checked 2026-11-03)

- **Vercel Hobby:** 1M function invocations and 4 CPU-hours a month. Functions can't hold
  WebSocket connections, so live updates mean either polling or an outside service.
- **Neon Free:** 100 CU-hours of compute a month; the database sleeps after 5 minutes with no
  queries. At the smallest size (0.25 CU) that's about 400 awake hours a month, around 13 a day.
  Anything that queries every few seconds keeps it awake while it runs.

## Decisions for the owner

Each has a recommendation; the milestones assume it.

1. **How new messages arrive (M28).**
   - _Recommended: polling, behind a replaceable adapter._ An open chat asks Branch for new
     messages every 5 seconds while the tab is in view, slowing to every 20 seconds after 2
     quiet minutes, stopping while the tab is hidden, and pausing after 30 minutes without
     activity (a "Check for new messages" button resumes it). No new service, nothing new to
     disclose. Rough cost for 10 friends with chat open an hour a day, mostly quiet: about 60,000
     invocations a month (6% of Vercel's), and the database awake for those hours, which it
     usually is anyway when people are using Branch. Messages arrive within 5–20 seconds.
   - _Alternative: a hosted realtime service's free plan_ (for example Pusher or Ably; terms
     checked before adopting). Instant delivery and no polling. Only a "new message in group X"
     signal would go through it, never the text, and Branch would authorize each subscription,
     but it's a new company processing data, so `/privacy` changes. The adapter makes this a
     later swap either way.
2. **What chat messages can do (M28).** _Recommended:_ text with the same Markdown and code
   highlighting as posts (no images), a spoiler switch per message, up to 2,000 characters;
   authors delete their own messages and the group admin deletes any (recorded in the group's
   audit log, as for posts). No editing, reactions, threads, typing indicators, read receipts, or
   unread counts (v1 has no notifications). Messages are kept until deleted; 20 a minute per
   person at most.
3. **Who handles reports (M29).** _Owner's answer: the group's admin handles every report,
   removing the content or dismissing the report, including reports about the admin's own
   content; no owner list or command._ Originally recommended: the group's admin. A member reports a post,
   comment, or chat message with a reason (spam, harassment, unmarked spoiler, something else) and
   an optional note. The admin sees open reports in the group's settings, can remove the content
   (as now, audited) or dismiss the report. The reported person never learns who reported them.
   If the admin is the one reported, the report goes to Branch's owner instead, who reads them
   with a command (`pnpm moderation:reports`); there's no owner admin page. _Alternative:_ every
   report goes to the owner only.
4. **What blocking does (M29).** _Owner's answer: as recommended._ Recommended: it's personal and silent. Blocking someone hides
   their posts, comments, chat messages, and reactions from you everywhere (shown as "Hidden: you
   blocked this person", with a Show button), and they can't comment on your posts or reply to
   your comments (they're told the person isn't taking replies, without saying why). It doesn't
   remove anyone from a group, and both of you still see group progress, which the shared plan
   needs. Unblock any time in Settings. _Alternative:_ hiding only, with no limits on replies.
5. **Error tracking (M30).** _Owner's answer: as recommended, a small table._ Recommended: no new
   service. Unexpected server errors are kept in
   a small table (when, where, the request ID, the error's name and message; never request bodies,
   code, or messages), deleted after 14 days by the daily job, and read with a command. Vercel
   Hobby keeps runtime logs for only an hour, so this is what makes errors findable.
   _Alternative:_ a hosted error tracker's free plan (for example Sentry), which is easier to read
   but sends error details to another company.

## M28 — Group chat

**Behaviour**

- Each group page gets a **Chat** tab (`/groups/[groupId]/chat`, beside Plan and Settings).
  Members only: anyone else, including former members, gets a 404, like the rest of the group.
- The newest 50 messages load with the page; scrolling up loads older ones (cursor by message
  ID). New messages appear at the bottom by polling (decision 1); if you've scrolled up, a "New
  messages" button takes you down instead of moving the page.
- The composer: Enter sends, Shift+Enter adds a line; a spoiler switch folds the message's code
  (like posts). Sending shows the message at once, marked "Sending…", and "Not sent. Try again"
  if it fails; nothing is lost if the connection drops, and the next poll catches up from the
  last message seen.
- Delete your own message, or any as the admin (audited, `MESSAGE_REMOVED`), with
  `ConfirmAction`. A deleted message is gone, not a tombstone.
- Rendering only through `components/feed/markdown.tsx` (no raw HTML, no images, safe links).

**Schema** (migration `group_chat`): `chat_message` (`id` UUIDv7, `groupId` cascade,
`authorId` cascade, `body` 1–2,000 characters with a non-space (CHECK), `spoiler`, `createdAt`),
index `(groupId, id DESC)`; `GroupAuditAction` gains `MESSAGE_REMOVED`.

**Code:** `modules/chat/` (`service.ts`: `listMessages` with `before`/`after` cursors,
`sendMessage`, `deleteMessage`, each starting from `requireMembership`; `transport.ts`: the
`ChatTransport` interface and the polling implementation; `actions.ts`; a JSON route
`GET /api/groups/[groupId]/chat?after=` for polling, `no-store`, session-checked),
`components/chat/` (the message list, composer, and poller, with an `aria-live="polite"` region
announcing new messages from others, at most one announcement every few seconds).

**Tests:** unit (polling intervals and pause rules with a fake clock; cursor merging without
duplicates); integration (members only, former members 404, cursors, rate limit, admin delete
audited, author delete, the CHECK); E2E (two people chat in two browsers and see each other's
messages without reloading; spoilers fold; delete; a non-member 404; scrolling up loads older;
keyboard sending and focus; axe in both themes; 320px; text spacing).

## M29 — Reporting and blocking

**Reporting (decision 3)**

- "Report" on posts, comments, and chat messages from others (a small menu beside Delete),
  opening a dialog with the reason and an optional note (up to 500 characters). Reporting the same
  thing twice is a no-op; at most 10 reports a day per person.
- The admin's group settings get a **Reports** section: each open report with its content (as the
  admin can already see it), reason, note, and when; **Remove content** (the existing audited
  delete, which also closes the report) or **Dismiss**. The reporter's name isn't shown to the
  admin either; the owner's command shows it, for abuse of reporting.
- Reports about the admin's own content go to the owner's list instead.

**Blocking (decision 4)**

- "Block" in a person's menu wherever their name appears with content (posts, comments, chat),
  confirmed in a dialog; Settings → **Blocked people** lists them, with Unblock.
- Reads filter blocked people's content into a folded "Hidden" row; the feed, comments, and chat
  queries take the viewer's block list (one indexed lookup per page, not per item).
- Writes: commenting on a blocker's post or replying to a blocker's comment is refused with a
  neutral message.

**Schema** (migration `reports_and_blocks`): `report` (`id`, `reporterId`, `groupId`, the
target as exactly one of `postId` / `commentId` / `messageId` with cascades and a CHECK,
`reason` enum, `note`, `status` OPEN/REMOVED/DISMISSED, `toOwner`, `createdAt`, `resolvedAt`,
`resolvedById`; unique per reporter and target); `user_block` (`blockerId`, `blockedId`,
`createdAt`; primary key on the pair; CHECK they differ).

**Tests:** integration (only members can report; one report per target; daily limit; admin-only
review; reports about the admin go to the owner; removing closes the report and audits it;
block hides content in feed, comments, and chat; blocked replies refused; unblock restores; the
CHECKs); E2E (report a comment, the admin removes it; block someone and their chat message
folds; unblock in Settings); a command test for `moderation:reports`.

## M30 — Hardening

- **Security:** a Content Security Policy (scripts from Branch only, with Next's nonce;
  `connect-src` to Branch; images from Branch, Vercel Blob, and the Google and GitHub avatar
  hosts; `frame-ancestors 'none'`), `Strict-Transport-Security`, and a check that every server
  action and route starts from `requireViewer()` or its own token check (a test that lists them).
  `pnpm audit` for known-vulnerable dependencies, and fixes within the pinned versions.
- **Rate limits** where there are none yet: reactions, marking problems solved (each toggle stays
  idempotent), chat (M28), reports (M29); one shared limiter on Postgres, like the existing ones.
- **Errors (decision 5):** a request ID on every response (`x-request-id`, made in `proxy.ts`) and
  in every log line; unexpected errors recorded with it; friendly error pages show it, so a
  person can quote it.
- **Performance:** measure the heaviest pages (Home, a group, Solutions, Stats) with the production
  build; fix N+1 queries and missing indexes found by reading query plans; keep the client
  JavaScript of the main pages from growing (a recorded budget checked in CI-free form by a
  script).
- **Accessibility:** a full pass with the existing checks, plus a screen-reader read-through of
  chat (live region volume, focus after sending and deleting).

**Tests:** headers on every route type; the CSP doesn't break the app (the whole E2E suite runs
with it); the action and route audit; rate limits; request IDs in responses and logs; error
recording without request bodies.

## M31 — Rollout readiness, journeys, and docs

- **Deployment checks:** `docs/DEPLOY.md` gains a pre-release checklist (migrations applied, env
  vars, cron, consent screen published, CSP report clean, the backups).
- **Scaling runbook** (`docs/SCALING.md`): what to watch (Vercel invocations and CPU, Neon
  CU-hours and storage, Blob operations), what happens at each limit, and the next step for each:
  Neon Launch, Vercel Pro, a realtime service for chat, a queue for analysis, with their current
  prices checked when written.
- **Journeys:** a Phase 5 E2E across chat, reporting, and blocking; the PRD's acceptance
  scenarios re-run as one suite.
- **Docs and summary:** README, `/privacy` (chat messages stored and who sees them, reports and
  blocks, error records), CLAUDE.md, the changelog, and the Phase 5 summary. Then stop.

## Risks and limits

- **Polling delay:** messages take up to 5 seconds to arrive while active, 20 when quiet; good
  for a study group, not for fast back-and-forth. The adapter is the way out.
- **Neon compute:** chat left open keeps the database awake; the 30-minute pause bounds it.
  The runbook says what to watch.
- **Moderation is small:** an admin who abuses their role can only be handled by the owner, by
  hand. Reports aren't a substitute for invite-only groups, which stay.
- **CSP:** a strict policy can break third-party pieces quietly; the full E2E suite running with
  it is the safeguard.
