# Deploying Branch (soft launch)

A zero-cost setup for a handful of friends: **Neon** (Postgres, Free plan) and **Vercel** (web app,
Hobby plan). Terms were checked on 2026-11-03; check them again before you rely on them.

| Service      | Free allowance that matters here                                      | Caveats                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon Free    | No card. 1 GB storage per project, 100 CU-hours a month, 5 GB egress. | Scales to zero after 5 minutes idle, so the first request after a pause takes about a second. Restore history is only 6 hours, with 1 manual snapshot. Over the limits, compute pauses until next month; data is kept. |
| Vercel Hobby | 1M function invocations, 4 CPU-hours, 100 GB transfer a month.        | Personal, non-commercial use only. Runtime logs are kept for 1 hour. Over the limits, the feature pauses for 30 days.                                                                                                  |

## 1. Create the database (Neon)

1. Sign up at https://neon.com and create a project named `branch`. Pick **AWS US East (N.
   Virginia)**: it is next to Vercel's default function region (`iad1`), which keeps every query
   fast.
2. Open **Connect** on the project dashboard. Copy two connection strings for the `neondb`
   database:
   - **Pooled** (host contains `-pooler`). The app uses this one.
   - **Direct** (turn off "Connection pooling"). Migrations use this one.

   Both end in `?sslmode=require`; keep that. Treat both as passwords.

## 2. Create the schema and load the curated lists

Run these from your machine, at the repository root, with the **direct** string. The variables on
the command line take priority over `.env`, so your local setup is untouched.

```bash
export PROD_DIRECT_URL='postgresql://…neon.tech/neondb?sslmode=require'   # direct, not -pooler

DATABASE_URL="$PROD_DIRECT_URL" pnpm db:deploy        # applies every migration in prisma/migrations
DATABASE_URL="$PROD_DIRECT_URL" pnpm db:load-curated  # 150 problems, Patterns 150, Essentials 75
```

Both are safe to run again. Never run `pnpm db:seed` against production: it creates dev accounts,
and it refuses when `NODE_ENV=production`.

Re-run `db:deploy` **before** pushing any commit that adds a migration, so the new code never meets
an old schema.

## 3. Deploy the app (Vercel)

1. Sign up at https://vercel.com with GitHub and choose **Add New → Project**. Import
   `lawrenceDegoma/Branch`.
2. Set **Root Directory** to `apps/web`. Vercel finds the pnpm workspace and installs from the
   repository root. Leave the framework (Next.js) and the build command as they are. Set the
   Node.js version to 22.x in **Settings → Build and Deployment**.
3. Add these under **Environment Variables**, for Production only:

   | Name                 | Value                                                                    |
   | -------------------- | ------------------------------------------------------------------------ |
   | `DATABASE_URL`       | Neon's **pooled** string                                                 |
   | `BETTER_AUTH_SECRET` | A new secret from `openssl rand -base64 32`. Don't reuse your local one. |
   | `BETTER_AUTH_URL`    | The production URL, for example `https://branch-xyz.vercel.app`          |

   Leave `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` unset unless you want GitHub sign-in (see
   below).

4. Deploy. On the first deploy you don't know the URL yet: deploy once, copy the domain Vercel
   gives you, set `BETTER_AUTH_URL` to it, and **redeploy** so the new value takes effect. Sign-in
   fails with an origin error until `BETTER_AUTH_URL` matches the address in the browser exactly.
5. From then on, every push to `main` deploys automatically.

**Preview deployments:** Vercel also builds a preview for each pull request. Previews have no
environment variables, so they fail to start. That's intended: it keeps them away from production
data. Turn previews off under **Settings → Git** if the failed builds bother you.

## 4. Smoke test

1. Open `https://<your-domain>/api/health`. It should return `{"status":"ok"}`, which means the settings are valid and the database answers.
2. Create your account, create a group, choose Essentials 75, and start the plan.
3. Create an invite link in the group's settings and send it to your friend.
4. Each of you marks a problem solved, and checks that the other sees it on the group page.

## Password resets

Branch sends no email. When someone forgets their password, create a link for them:

```bash
DATABASE_URL="$PROD_DIRECT_URL" BETTER_AUTH_URL='https://<your-domain>' \
  pnpm auth:reset-link -- friend@example.com
```

Send them the printed link privately: whoever holds it can set the password. It works once and
expires after an hour. Using it signs that account out on every device. The pooled string works
here too.

## Optional: Google and GitHub sign-in

Each button appears only when both of its variables are set; setting just one stops the app from
starting. Redeploy after adding them.

- **GitHub:** create an OAuth app at https://github.com/settings/developers with the callback URL
  `https://<your-domain>/api/auth/callback/github`, then set `GITHUB_CLIENT_ID` and
  `GITHUB_CLIENT_SECRET`. An OAuth app has one callback URL, so local development needs its own
  app with `http://localhost:3000/api/auth/callback/github`.
- **Google:** in Google Cloud Console, set up the OAuth consent screen (audience **External**,
  basic scopes only) and create an OAuth client ID of type "Web application" with the redirect
  URI `https://<your-domain>/api/auth/callback/google`. Set `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET`. While the consent screen is in **Testing**, only the test users you list
  can sign in; add your friends' Google addresses, or publish the app.

Branch can't confirm email addresses, so Better Auth won't attach a Google or GitHub sign-in to an
existing email-and-password account with the same address (it would let anyone claim an account).
That person sees "That sign-in didn't complete" and should keep using their password.

## Backups

Neon Free keeps only 6 hours of history. Before risky changes, or weekly, take a dump (this needs
`pg_dump` 17 or newer, for example from `brew install postgresql@17`):

```bash
pg_dump "$PROD_DIRECT_URL" --format=custom --file="branch-$(date +%F).dump"
```

Store the dumps outside the repository: they contain password hashes.

## Before anything beyond friends

Anyone who finds the URL can create an account. They can't see any group without an invite, but
open sign-up and a public URL are fine only for a soft launch. Before a wider launch, revisit:
email delivery and verification, rate limits on completions, CI, and monitoring (Phase 5).
