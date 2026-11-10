# Branch — Product Requirements Document

**Status:** Implementation-ready product direction, v0.2 (brand identity selected)  
**Product name:** Branch  
**Positioning:** Strava for LeetCode  
**Working tagline:** Grow together. Solve better.  
**Last updated:** 2026-11-03

## 1. Vision

**Branch** is a social accountability web application where friends progress through shared coding-interview roadmaps, celebrate accepted LeetCode submissions, ask for help, and receive private, personalized practice recommendations. The experience should feel socially motivating like Strava, with the visual polish and restraint of Linear/Vercel. It is **not** a coding judge or LeetCode replacement.

### Product principles

1. Social motivation before gamification: genuine activity, reactions, comments, milestones, and group camaraderie; avoid shaming, noisy XP, and mandatory rankings.
2. Shared schedule, individual pace: group assignments advance on calendar; unfinished problems remain available; users can catch up or work ahead.
3. Privacy by design: private groups, user-controlled posting, private code and proficiency signals, spoiler-aware discussions.
4. Useful without an extension: manual progress and community features must work independently.
5. Start near zero cost, preserve scaling options: modular monolith, pagination, background jobs, replaceable providers.
6. Each development phase ends in a usable, tested product increment.

## 2. Audience and jobs to be done

**Primary:** students, new graduates, and friends preparing for coding interviews together.  
**Later:** independent learners and broader communities using shareable roadmaps.

Users need to: (a) see what friends are studying, (b) know what to solve this week, (c) track progress without losing their place, (d) get help when stuck, and (e) identify what to review without being publicly judged.

## 3. Scope and release phases

| Phase | User-visible deliverable | Exit criterion |
|---|---|---|
| 1 — Foundation | Sign-in, profile, group creation/invites, roadmap selection/customization, calendar-based weekly assignments, manual completion, responsive shell | Two users can join a group, see the same weekly plan, and independently track progress |
| 2 — Social | Unified feed, auto-generated milestone/completion posts for recorded completions, manual posts, code blocks, reactions, threaded comments, group filters | Group members can discuss a problem and see activity across groups with correct privacy |
| 3 — LeetCode integration | Opt-in WXT extension, accepted-submission capture where technically feasible, deduplication, fallback manual entry | A supported accepted submission syncs once and updates progress; failures are recoverable |
| 4 — Personalized review | Spaced review, weakness-based new practice, asynchronous code-analysis pipeline, explainable recommendations | User gets private review suggestions; uncertain analysis does not masquerade as fact |
| 5 — Collaboration/polish | Group chat, accessibility/performance refinements, deployment hardening | Chat works with appropriate access control and the app is ready for broader rollout |

**MVP definition:** Phases 1–2 create the first social, usable release. The complete product vision includes phases 3–5. Do not block the MVP on LeetCode integration or AI analysis.

**Owner changes (2026-11-04):** image uploads dropped from posts; reporting and blocking deferred to a later phase (owner, 2026-11-09: they're part of Phase 5). The phase order is unchanged: the extension (phase 3) comes before review, because it is how solution code reaches the analyzer.

**Explicitly out of v1:** push/email/in-app notification center, public group discovery, monetization, full in-browser coding judge, compulsory leaderboards, automatic publishing of source code, elaborate XP economy. (Owner change, 2026-11-09: a person may turn on a setting, off by default, that attaches their code as a spoiler to their own automatic solve posts.)

**Owner additions (2026-11-09), after Phase 4 and before Phase 5:** solutions on solve posts (opt-in, above); a study-session timer and an extension problem timer with an optional time budget (toolbar badge and popup, never changing the coding sites' pages); private personal statistics; study sessions can be shared to a group one at a time, by the person's choice (with a remembered choice in Settings). Plan: `docs/PLAN-ADDITIONS.md`; decisions in `docs/DECISIONS.md`.

## 4. Core concepts and business rules

### Users and groups
- A user can join multiple groups. Groups are private/invite-only initially.
- Each group has members, an admin, exactly one active shared roadmap plan, start date, and calendar-driven weekly schedule. Admin role can be transferred.
- Members can view group activity and assignments; only authorized admins change the group's roadmap/schedule or membership settings.
- Group activity must never leak to nonmembers. A unified feed is a union of *authorized* group activities, not a public timeline.

### Roadmaps and catalog
- Maintain canonical problem records with stable internal IDs, LeetCode references/slugs when known, title, URL, difficulty, tags/patterns, and optional curated metadata.
- Ship curated roadmap definitions for **NeetCode 150, Blind 75, and Grind 75** only with verified, appropriately sourced problem mappings; allow admin-created custom roadmaps at launch.
- Roadmaps contain ordered sections and problem references; a group attaches to a version/snapshot of a roadmap so future edits do not silently rewrite assignments.
- Custom roadmaps initially private or link-shareable; public publishing/discovery is later scope.
- Weekly assignments can be admin-configured and should advance according to the group's calendar even if some members are behind.
- Problems left unfinished remain in a personal backlog. Working ahead is permitted.

### Completion and progress
- A canonical **user + problem** accepted completion is counted once globally, even when the problem appears in multiple groups or roadmaps.
- Completion is reflected in all applicable roadmap progress views. Re-submissions may update analysis history but must not create a second completion. (Owner change, 2026-11-09: a new accepted submission of an already solved problem may post a distinct "solved again" activity, at most once a week per problem, with the same opt-in.)
- Record completion source (`manual`, `extension`, later `import`), timestamp, optional language, and external submission ID where available.
- Personal weekly goals are optional and secondary to the shared roadmap.
- Keep roadmap completion, review sessions, and code-analysis outcomes as distinct concepts.

### Activity feed
- **Home is feed-first.** Unified chronological activity from all groups, with group filtering and clear group labels.
- Desktop layout: left navigation; center activity feed; right 'Your Week' summary with assignments/progress/reviews. Mobile: single-column feed, compact weekly summary, bottom navigation.
- Navigation: Home, Roadmaps, Groups, Review, Profile. Chat is accessed within a group. (Owner change, 2026-11-09: Home, Roadmaps, Groups, Review, Solutions; profile details live in Settings, and there is no separate Profile page.)
- Auto-generated posts for newly accepted problems and meaningful milestones, **subject to user opt-in and per-post visibility control**. Do not publish duplicates for re-submissions; a re-solve is its own, rate-limited activity (owner change, 2026-11-09).
- Manual posts support help requests, tips, reflections, Markdown-style text, and syntax-highlighted code blocks. No image uploads (owner decision, 2026-11-04).
- Posts support reactions and threaded comments (initial UI depth cap: two reply levels; maintain a clear data model for parent relationships).
- Posts and comments should support spoiler marking/collapsing, especially for solutions.
- Privacy: private group scope; never automatically expose source code, weakness metrics, or detailed analysis (except code on one's own solve posts, by a setting that is off by default; owner change, 2026-11-09). A post should have a clear group destination; no cross-group forwarding by default.
- No notifications in version one. (Owner change, 2026-11-09: after an update, Home shows a dismissible "What's new" card linking to a public changelog; it's part of Home, not a notification.)

### Personalized review (phase 4)
- **Spaced repetition:** revisit previously solved problems based on review performance/history.
- **Targeted new practice:** suggest new, often easier problems for concepts the user struggles with.
- Inputs may include problem pattern/difficulty, completion/review history, and estimated time/space complexity of submitted code.
- Complexity estimation is uncertain and language-/approach-dependent. Represent confidence, rationale, and legitimate tradeoffs; never equate a single asymptotic result with solution quality.
- Recommendations and proficiency estimates are private to the user. Do not reveal an optimal solution as part of passive analysis.

### Browser extension (phase 3)
- WXT + TypeScript extension, permissioned and opt-in, intended to detect accepted LeetCode submissions and capture metadata/source when technically feasible.
- Website behavior and access to submission code may change; prototype feasibility before committing to automation guarantees. Do not imply an official supported LeetCode integration.
- Minimize host permissions; clear user consent and disclosure of what is sent; secure extension-to-app authentication; idempotent ingestion; explicit disconnect/revoke.
- Web app remains useful with manual completion recording.

### Chat (phase 5)
- Each group has its own general-purpose chat. Only active members can read/write.
- Start with a simple, replaceable realtime transport; persistent messages remain in PostgreSQL. Spoiler handling applies where appropriate.

## 5. UI and design requirements

- Visual direction: **Strava-first social energy** with **Linear/Vercel-level developer-tool polish**.
- Design dark mode first (charcoal, not pure black), but ship **Dark / Light / System** on day one; default to System and persist user preference.
- Light mode: soft off-white canvas, white surfaces, dark text. Both modes use restrained vibrant orange accent, subtle borders, generous whitespace, strong typography, purposeful progress visuals.
- Use accessible contrast, visible keyboard focus, reduced-motion support, responsive layouts, skeleton/loading/empty/error states.
- Use Tailwind + shadcn/ui as base. 21st.dev can inspire or supply individual components, but all adopted components must conform to shared tokens and accessibility requirements.
- Avoid random decorative animations, oversized gamification, and inconsistent component styles.

### Branch brand identity and interaction tone

- **Official product name:** `Branch` (capital B in prose, product metadata, accessibility labels, and documentation). A lowercase **`branch.`** wordmark is an optional visual treatment, not a separate product name.
- **Working tagline:** "Grow together. Solve better." Use as provisional marketing copy; it may be refined later without affecting domain or component architecture.
- **Brand meaning:** A branch evokes Git/developer culture, diverging learning paths, and growth rooted in a shared community. Keep the product recognizable as social progress, not a Git client or code-hosting tool.
- **Logo direction:** A simple original branching path/nodes symbol paired with a modern sans-serif wordmark. A temporary Lucide-style `git-branch` glyph is acceptable during development; final logo artwork remains to be designed and checked.
- **Palette starting points (not hard-coded accessibility guarantees):** charcoal canvas `#17191D`, raised dark surface `#262A30`, muted dark-mode text `#A4A7AD`, energetic orange accent `#FF683B`; soft off-white light canvas `#F7F7F5`. Choose accessible foreground colors for every background and re-check contrast in both themes.
- **Personality:** supportive, optimistic, concise, and credible. Celebrate consistency and community progress; never use public shame, forced competition, or misleading claims about mastery.
- **Naming discipline:** Use `Branch` for the app; `group`, `roadmap`, `weekly assignment`, and `review` retain their clear product meanings. Do not automatically rename groups to "branches" or imply an official affiliation with LeetCode/NeetCode.
- **Assets and external identity:** Use Branch in page titles, app shell, onboarding, social sharing metadata, README, and extension UI when built. Public domain, handles, trademark clearance, and final logo must be checked before launch; no domain availability is assumed.

### Key screens
1. **Home:** unified feed, group filter, post composer, right-side weekly summary (mobile compact), reactions/comments.
2. **Group:** members, current roadmap, this week's assignments, progress, activity, group chat when shipped, admin settings.
3. **Roadmap:** ordered sections, assigned weeks, completion state, overdue/backlog, ahead-of-schedule work.
4. **Review:** due reviews, targeted new problems, explanation of why each was suggested, private performance history.
5. **Profile:** personal accomplishments, group memberships, goals, appearance, privacy, extension connection. (Owner change, 2026-11-09: part of Settings, including milestone badges and a profile photo: the one from Google or GitHub, an upload, or initials. New accounts sign in with Google or GitHub only; password accounts can move to one and keep their data.)
6. **Admin setup:** create group, invite, choose/author roadmap, define schedule and dates, transfer admin.

## 6. Data and event semantics

Suggested entities: `User`, `Session/Account`, `Group`, `GroupMembership`, `GroupInvite`, `Problem`, `Roadmap`, `RoadmapVersion`, `RoadmapSection`, `RoadmapItem`, `GroupRoadmapPlan`, `WeeklyAssignment`, `ProblemCompletion`, `Submission`, `Activity`, `Post`, `Comment`, `Reaction`, `ReviewAttempt`, `ReviewSchedule`, `ConceptProficiency`, `AnalysisJob`, `AnalysisResult`, `GroupMessage`.

Design decisions:
- Keep source submissions separate from the single canonical completion record.
- Attach group scope and access checks to every social item.
- Record stable idempotency keys for extension ingestion and auto-generated activities.
- Store roadmaps as versioned definitions; group plans reference versions.
- Use soft-delete or explicit deletion semantics where needed, with retention policies for code and media.
- Ensure personal progress shared across groups does **not** automatically create a post in every group without the user's selected posting scope.

## 7. Security, trust, and safety

- Server-side authorization on every group, post, comment, roadmap edit, message, media access, and analysis request. Never trust client-side group IDs alone.
- Sanitize rendered Markdown and code; prohibit executable HTML; validate file MIME/size and use signed upload URLs where appropriate.
- Rate-limit posting, reactions, invites, extension sync, and expensive analysis.
- Protect against duplicate submissions, spam, and unintended spoilers. Provide delete/report/block capabilities as the product grows; define minimal moderation controls before broader public access.
- Code is private by default; define explicit retention/deletion choices and avoid sending code to third-party models without clear user disclosure/consent.
- Maintain secure auth sessions, CSRF protections where applicable, audit-sensitive group admin actions, and secrets only server-side.

## 8. Nonfunctional requirements and cost constraints

- Near-zero hosting cost at friends-and-family scale; no assumption that a provider's free tier is permanent or permits every use case.
- Modular monolith for core web app; separate asynchronous Python analysis worker only when phase 4 needs it.
- PostgreSQL relational constraints and indexes, cursor pagination for feeds/comments, efficient group-membership filtering, bounded queries, image optimization.
- Replaceable adapters for realtime, storage, queue, and AI providers. Avoid Kubernetes and premature microservices.
- Observability: structured logs, request IDs, job retry/dead-letter handling when jobs arrive, error reporting within free-tier budget.
- Test permissions, deduplication, scheduling/timezones, and cross-group completion behavior.

## 9. Acceptance scenarios

1. Two friends join one invite-only group and see the same current-week problems.
2. A member misses last week's assignment; it remains incomplete while the group advances.
3. A member completes a problem appearing in two roadmaps; both progress views update, with one canonical completion.
4. A member creates a help post with code, marks the code as a spoiler, and receives threaded replies.
5. A nonmember cannot access private group activity through the feed, direct URLs, or APIs.
6. A user disables auto-sharing; their completion still updates progress but does not create a visible post.
7. Re-submitting an accepted solution does not create a second completion or a duplicate solve post; at most one "solved again" post a week per problem, with sharing on.
8. A user without the extension can manually track problems and use social features.
9. An uncertain complexity analysis is labeled as such and does not expose source code to other members.
10. Theme follows system by default and user overrides persist.
11. The app shell, browser title, and onboarding identify the product as **Branch**, with consistent accessible branding in both themes.

## 10. Open implementation decisions

- Domain/handle and trademark availability; final original logo asset and approval of the working tagline. The selected product name is **Branch**.
- Precise curated roadmap source/licensing and initial problem catalog ingestion process.
- Week boundary and group timezone defaults; recommend storing IANA timezone per group.
- Manual completion verification policy (trust-based initially, label source internally).
- Storage/realtime/queue provider selection after free-tier and terms review.
- LeetCode extension feasibility, privacy UX, and code-analysis accuracy evaluation.
- Moderation/reporting scope before opening groups beyond invite-only (reporting and blocking deferred by the owner, 2026-11-04; part of Phase 5 since 2026-11-09, plan in `docs/PLAN-PHASE-5.md`).
