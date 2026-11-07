# Publishing Branch for LeetCode to the Chrome Web Store

Everything the Chrome Web Store developer dashboard asks for, ready to paste, and the order to do
it in. Checked against Google's documentation on 2026-11-05 (neetcode.io added 2026-11-07); if a field has moved or been renamed,
the content still applies.

## Before you start

1. **Production is up to date.** M17 and M18 are pushed and deployed, and the M16 migration and
   `CRON_SECRET` are in place.
2. **Set `PRIVACY_CONTACT_EMAIL` in Vercel** (Production) to the address people should write to
   about their data and account deletion, then redeploy. Check that
   `https://branch-omega-vert.vercel.app/privacy` shows it under "Your choices". The store also
   shows your developer contact email publicly; they can be the same address.
3. **Name and logo.** The listing is public, so check that you're comfortable using "Branch" and
   the logo publicly (CLAUDE.md asks for this before any public launch). The name "Branch for
   LeetCode" uses LeetCode's name to say what the extension works with, and the listing says
   Branch isn't affiliated with LeetCode. Google may still question it; if they do, rename it in
   `apps/extension/wxt.config.ts` (for example "Branch: LeetCode progress sync") and resubmit.
4. **A reviewer account.** Sign up on production as a new account for Google's reviewers (an
   address you control, a fresh password). Create a group as that account and choose the
   Patterns 150 roadmap, so the reviewer sees a plan. You'll paste these credentials into the Test
   instructions tab. Don't use your own account.
5. **Build the package:** from the repository root,

   ```sh
   pnpm --filter @branch/extension zip
   ```

   The upload file is `apps/extension/.output/branch-for-leetcode-<version>-chrome.zip` (1.1.0 adds
   neetcode.io). It points at production (`https://branch-omega-vert.vercel.app`).

6. **Images** are in `apps/extension/store/` (regenerate with the command at the top of
   `apps/web/e2e/store-assets.spec.ts`).

## Step by step

### 1. Upload

1. Open the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole)
   and sign in with your developer account.
2. Click **Add new item**, choose `branch-for-leetcode-1.0.0-chrome.zip`, and upload. (For an
   update, see step 8.)

### 2. Store listing tab

- **Description:**

  > Solve on LeetCode or neetcode.io, and it counts in Branch.
  >
  > Branch is a place to work through a coding-interview roadmap with friends: your group shares
  > one plan, a few problems a week, and everyone progresses at their own pace. This extension
  > connects LeetCode and neetcode.io to it. When a solution you submit is accepted, the problem
  > is marked solved in Branch, in every group and roadmap that includes it. No copying links, no
  > ticking boxes.
  >
  > How it works
  > • Connect it from Branch's Settings with one click.
  > • Submit on leetcode.com or neetcode.io as usual. When your submission is accepted, Branch
  > records the problem as solved within a few seconds.
  > • The popup shows what it last saw and synced, and anything waiting to send.
  >
  > Private by design
  > • Nothing is collected until you connect, and nothing after you disconnect.
  > • For each accepted submission, it sends Branch the problem, the language, your code, and the
  > time. On neetcode.io it also reads the name of the problem you open, to tell which LeetCode
  > problem it is. Nothing else on either site is read or sent.
  > • Your code is visible only to you in Branch, and you can delete it at any time.
  > • Your groups see a solve only if you turn on "Share my solves".
  > • The extension never makes requests to LeetCode or neetcode.io; it only reads the results of
  > submissions you make.
  >
  > You need a Branch account to use it. Branch is independent and not affiliated with LeetCode or
  > NeetCode.

- **Category:** Productivity (Education also fits; pick one).
- **Language:** English.
- **Store icon:** taken from the package (128×128).
- **Screenshots** (1280×800, in this order): `screenshot-1-popup.png`, `screenshot-2-home.png`,
  `screenshot-3-group.png`, `screenshot-4-code.png`, `screenshot-5-privacy.png`.
- **Small promo tile** (440×280): `promo-small-440x280.png`.
- **Marquee promo tile** (1400×560, optional): `promo-marquee-1400x560.png`.
- **Official URL:** leave empty unless you've verified a domain. **Homepage URL:**
  `https://branch-omega-vert.vercel.app`. **Support URL:** the same, or leave empty.

### 3. Privacy tab

- **Single purpose:**

  > Records the LeetCode problems you solve in Branch: when a submission you make on leetcode.com
  > or neetcode.io is accepted, the extension sends it to your Branch account so the problem counts
  > as solved in your groups and roadmaps.

- **Permission justifications:**
  - **storage:** "Keeps the key that connects the extension to the user's Branch account, a short
    queue of accepted submissions waiting to be sent, and the popup's status, in the browser's
    local extension storage."
  - **alarms:** "Retries sending a submission later when Branch is unreachable or rate-limits the
    request, so accepted submissions aren't lost while offline."
  - **Host permissions** (this covers `https://branch-omega-vert.vercel.app/*` and the content
    scripts on `https://leetcode.com/*` and `https://neetcode.io/*`): "leetcode.com and
    neetcode.io: content scripts observe the results of submissions the user makes, to detect when
    one is accepted (on neetcode.io also the name of the problem opened, to identify it); they
    never make requests to either site. branch-omega-vert.vercel.app: the extension sends accepted
    submissions to the user's Branch account there, and a content script on Branch's Settings page
    receives the connection key when the user chooses Connect."
- **Remote code:** "No, I am not using remote code."
- **Data usage**, what the extension collects (tick these):
  - **Website content and resources:** the problem and verdict of an accepted submission on
    LeetCode or neetcode.io.
  - **User-generated content:** the solution code the user wrote.
  - **Authentication information:** the Branch connection key the extension stores and sends
    with each request.

  Leave the others unticked: no personally identifiable information is collected by the extension
  (it reads the user's Branch name for the popup but doesn't collect it), and no browsing history,
  form data, personal communications, location, health, or financial information. If you'd rather
  be conservative, also ticking **Web browsing activity** (which LeetCode problems you solved) is
  harmless.

- **Certifications:** tick each statement. They certify that data isn't sold, isn't used or
  transferred for anything unrelated to the single purpose, and complies with the Limited Use
  policy; Branch's handling matches all of them, and the privacy policy says so.
- **Privacy policy URL:** `https://branch-omega-vert.vercel.app/privacy`

### 4. Distribution tab

- **Payments:** Free.
- **Visibility:** Public.
- **Regions:** All regions.

### 5. Test instructions tab

> Branch account for review: <reviewer email> / <reviewer password>
>
> 1. Install the extension. A welcome page explains what it reads and sends; choose "Agree and
>    connect in Branch".
> 2. Sign in to Branch with the account above. On Settings, under LeetCode extension, click
>    "Connect a browser". The page confirms the extension is connected (or shows a key to paste
>    into the extension's popup).
> 3. Sign in to leetcode.com with any free LeetCode account, open
>    https://leetcode.com/problems/two-sum/ and submit a correct solution.
> 4. Within a few seconds the extension's popup shows "two-sum, counted", and Branch shows Two Sum
>    as solved (Home, and Settings → Synced submissions, where the code is visible only to this
>    account).
>
> The extension only observes the results of the user's own submissions on leetcode.com and never
> makes requests to LeetCode. A LeetCode account is needed to submit; we can't share one.

### 6. Submit

1. Check that every tab is complete (the dashboard flags missing fields).
2. Click **Submit for review**. In the confirmation dialog, leave "publish automatically after
   approval" ticked to go live as soon as it's approved, or untick it to publish by hand. After
   approval you have 30 days to publish before the submission reverts to a draft.
3. Turn on publishing notifications on the dashboard's **Account** page if you want an email.

Review usually takes a few days; extensions with host permissions can take longer. If Google asks
for changes, tell me what they said and I'll make them.

### 7. After it's live

- Copy the listing's URL (`https://chromewebstore.google.com/detail/…`), set it as
  `EXTENSION_STORE_URL` in Vercel (Production), and redeploy. Settings → LeetCode extension then
  shows **Get the extension** to anyone whose browser doesn't have it; until then it says the
  extension is coming soon.
- Every update: bump `version` in `apps/extension/package.json`, run the zip command, and upload
  the new zip on the item's **Package** tab, then submit for review again.

### 8. Updating to 1.1.0 (neetcode.io)

1. Production first: apply the `submission_sites` migration
   (`DATABASE_URL="$PROD_DIRECT_URL" pnpm db:deploy`), then push, so Branch accepts neetcode.io
   submissions before any extension sends them. 1.0.0 keeps working throughout.
2. `pnpm --filter @branch/extension zip` makes `branch-for-leetcode-1.1.0-chrome.zip`.
3. On the item's **Package** tab, upload it.
4. **Store listing:** paste the updated description above.
5. **Privacy:** paste the updated single purpose and host-permission justification above; under
   data usage, nothing new to tick.
6. **Test instructions:** add: "neetcode.io works the same way: open
   https://neetcode.io/problems/duplicate-integer/question, submit a correct solution, and Contains
   Duplicate shows as solved in Branch."
7. Submit for review. Because neetcode.io is a new site, Chrome turns the extension off for
   existing users until they accept the new permission (a prompt on the extensions menu).
