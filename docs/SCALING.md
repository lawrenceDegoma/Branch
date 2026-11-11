# Scaling Branch

Branch runs free on Vercel Hobby and Neon Free (docs/DEPLOY.md). This page is what to watch,
what happens when a free limit is reached, and the next step for each, with what it costs.
Prices were checked on 2026-11-10 from each provider's own pricing page; check again before you
rely on them. Nothing here is set up: each step is the owner's decision.

## What to watch, monthly

| What                      | Where                   | Free limit                                  | When to act          |
| ------------------------- | ----------------------- | ------------------------------------------- | -------------------- |
| Function invocations      | Vercel → Usage          | 1M a month                                  | Past 600k in a month |
| Active CPU                | Vercel → Usage          | 4 hours a month                             | Past 2.5 hours       |
| Data transfer             | Vercel → Usage          | 100 GB a month                              | Past 60 GB           |
| Database compute          | Neon → Monitoring       | 100 CU-hours a month                        | Past 60              |
| Database storage          | Neon → Monitoring       | 1 GB                                        | Past 600 MB          |
| Database egress           | Neon → Monitoring       | 5 GB a month                                | Past 3 GB            |
| Photo storage and uploads | Vercel → Storage → Blob | 1 GB, 2,000 uploads, 10 GB transfer a month | Past 60% of any      |
| Server errors             | `pnpm errors`           | none                                        | Any repeating error  |

The thresholds leave room for a busy month. Vercel emails as Hobby nears its limits; Neon shows
usage on its dashboard.

## What happens at a free limit

- **Vercel Hobby** can't buy more: past a limit, the feature pauses for up to 30 days (for functions,
  the site stops serving its pages). Hobby is for personal, non-commercial use only.
- **Neon Free**: past 100 CU-hours the database pauses until next month; data is kept. Storage is
  capped at 1 GB.
- **Vercel Blob on Hobby**: past a limit, Blob is blocked for up to 30 days; photos fall back to
  Google's or GitHub's, or initials, and uploads stop.

## The next step for each

**The database: Neon Launch.** Pay for use, no monthly minimum: $0.106 per CU-hour of compute and
$0.35 per GB-month of storage. The same Postgres, same connection strings: upgrade in Neon's
dashboard, no code change. At the smallest size (0.25 CU), an always-awake database is about 180
CU-hours a month, about $19; Branch usually sleeps between visits, so real use is far less.
Launch also lengthens the restore window beyond Free's 6 hours.

**Hosting: Vercel Pro.** $20 a month per seat, with $20 of usage included, then: invocations from
$0.60 per million, active CPU from $0.128 an hour, data transfer from $0.15 per GB past the 1 TB
included. Pro also allows commercial use, which a wider launch may need anyway. Upgrade in Vercel's
dashboard; no code change. Set a spend limit under Spend Management when you do.

**Photos: Blob on Pro.** Usage-based from Pro's included credit, regional prices (for example,
in Washington, D.C.: $0.023 per GB-month stored, $5 per million uploads, $0.05 per GB delivered).
Branch's photos are about 20 KB each, so a thousand people with uploads is about 20 MB.

**The code analyzer** (a separate Vercel project): its calls count toward the same Vercel limits.
If it gets busy, lower `DAILY_ANALYSES_PER_USER` in `apps/web/src/modules/analysis/service.ts`
before paying for more.

**Analysis jobs** wait in a Postgres table and run after each sync and from the daily job. That's
enough until analyses take longer than a request can; then a queue (a hosted one, or a worker on
another platform) replaces the job runner behind the same interface.

**Chat** (M28, on hold) will poll Branch for new messages while a chat is open, which keeps the
database awake while it's open. If that becomes the main cost, the plan is a hosted realtime
service's free plan behind the chat transport adapter; check its terms and prices when that time
comes (docs/PLAN-PHASE-5.md, decision 1).

## Before anything grows

- **Backups:** Neon Free keeps 6 hours of history. Take a `pg_dump` weekly and before risky
  migrations (docs/DEPLOY.md, "Backups").
- **Rate limits** are per person (posting, comments, reactions, completions, invites, reports,
  blocks, groups, roadmaps, study sessions, extension sync, analysis); `apps/web/src/lib/limits.ts`
  and the services hold the numbers. Raise them deliberately.
- **Sign-up** is open to anyone with the address, and groups are invite-only; reporting and
  blocking exist (M29). Opening groups to strangers needs more moderation first (PRD §10).
