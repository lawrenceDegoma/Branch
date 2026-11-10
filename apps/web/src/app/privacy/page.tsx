import { EXTENSION_DISCLOSURE } from "@branch/shared/extension";
import Link from "next/link";
import { BranchWordmark } from "@/components/brand/branch-mark";
import { serverEnv } from "@/lib/env";

export const metadata = {
  title: "Privacy policy",
  description: "What Branch and the Branch for LeetCode extension collect, and why.",
};

const EFFECTIVE = "November 10, 2026";

/** Public: linked from the Chrome Web Store listing, the extension, and Branch's own pages. */
export default function PrivacyPage() {
  const contact = serverEnv().PRIVACY_CONTACT_EMAIL;
  const contactLine = contact ? (
    <>
      email <a href={`mailto:${contact}`}>{contact}</a>
    </>
  ) : (
    "use the contact email on the Chrome Web Store listing"
  );

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Link href="/" className="self-start rounded-md py-1">
        <BranchWordmark />
      </Link>
      <main className="prose-branch mx-auto w-full max-w-2xl py-10">
        <h1>Privacy policy</h1>
        <p className="text-ink-muted">Effective {EFFECTIVE}</p>

        <p>
          Branch is a small, invite-based app for working through coding-interview problems with
          friends. It has a web app and an optional Chrome extension, Branch for LeetCode. This page
          explains what each collects, why, who can see it, and how to remove it. Branch is
          independent and not affiliated with LeetCode.
        </p>

        <h2>What the web app stores</h2>
        <ul>
          <li>
            <strong>Your account:</strong> name, email address, and the Google or GitHub account you
            sign in with (Branch receives its name, email address, and profile photo). Accounts made
            before Branch moved to Google and GitHub keep a password, stored only as a secure hash,
            until they connect one.
          </li>
          <li>
            <strong>Your profile and settings:</strong> username, optional bio, time zone,
            appearance, which photo to show, whether to share your solves, and what to do with study
            sessions.
          </li>
          <li>
            <strong>A photo, if you upload one:</strong> Branch shrinks it to a small square in your
            browser and stores it with Vercel Blob, under an address that can&apos;t be guessed.
            Otherwise the photo from Google or GitHub is shown, loaded from them and updated each
            time you sign in. If you sign in with Google, Branch keeps the sign-in token Google
            gives it, encrypted, and uses it only to fetch your current photo once a day while you
            show it. You can revoke it in your Google account at any time.
          </li>
          <li>
            <strong>Sign-in sessions:</strong> a session cookie, and the IP address and browser
            details of each session, used to keep you signed in and to protect your account.
          </li>
          <li>
            <strong>What you do in Branch:</strong> groups and invites, roadmaps, the problems you
            mark solved, your reviews and how they went, solutions you paste, study sessions (when
            each started and stopped), the time the extension measured on each solution, posts,
            comments, and reactions, reports you make, and the people you block.
          </li>
        </ul>

        <h2>What the Chrome extension reads and sends</h2>
        <p>{EXTENSION_DISCLOSURE}</p>
        <ul>
          <li>
            <strong>Sent to Branch</strong> for each accepted submission: which site it was made on
            (leetcode.com or neetcode.io), the site&apos;s ID for it (LeetCode&apos;s submission ID,
            or the time neetcode.io judged it), the problem, the language, your code, when it was
            judged, and how long the problem&apos;s page was open and in view before it was accepted
            (from extension version 1.2.0).
          </li>
          <li>
            <strong>Read for the problem timer:</strong> which problem a leetcode.com or neetcode.io
            tab is on (from its address) and whether the tab is in view. The minutes show on the
            extension&apos;s toolbar button and are sent only with an accepted submission. Your
            times are shown only to you in Branch.
          </li>
          <li>
            <strong>Read on neetcode.io to tell which problem it is:</strong> the name of the
            problem you open. Nothing else from the problem&apos;s page is read or sent: not its
            description, NeetCode&apos;s solutions, or your past neetcode.io submissions.
          </li>
          <li>
            <strong>Not read or sent:</strong> your username or profile on either site, other pages
            you visit (only whether a page is a problem, and which), your browsing history, your
            cookies or passwords, and submissions that aren&apos;t accepted.
          </li>
          <li>
            <strong>Stored in your browser only:</strong> the key that connects the extension to
            your Branch account, up to 50 accepted submissions waiting to be sent, the popup&apos;s
            last-sync status, your time budget, and each open tab&apos;s problem timer (kept until
            the browser closes). Disconnecting deletes them, except the budget.
          </li>
        </ul>
        <p>
          Nothing is collected until you connect the extension to your Branch account, and nothing
          is collected after you disconnect it.
        </p>

        <h2>How it&apos;s used</h2>
        <p>
          Only to provide Branch&apos;s features: tracking which problems you&apos;ve solved across
          your groups and roadmaps, showing you your own synced code, and the activity you choose to
          share. Branch doesn&apos;t sell data, show ads, or use data for advertising.
        </p>
        <p>
          The use of information received from the extension adheres to the{" "}
          <a href="https://developer.chrome.com/docs/webstore/program-policies/policies">
            Chrome Web Store User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>

        <h2>Who can see it</h2>
        <ul>
          <li>
            <strong>Your code is visible only to you</strong> unless you share a solution to a group
            yourself (Solutions → Share). Then that group&apos;s members see what you chose to
            include: its estimate, a note, and your code only if you ticked it. Your code goes on
            your automatic solve posts only if you turn on &quot;Add my code to my solve posts&quot;
            (Settings → Sharing; off unless you choose it): then that solve&apos;s group sees the
            code, folded until opened, and turning it off takes it off every post at once. Its
            analysis is never posted automatically.
          </li>
          <li>Your reviews and how they went are visible only to you, and so is Your stats.</li>
          <li>
            When you report a post or comment, the group&apos;s admin sees the reason and any note,
            but not that it was you; nobody else sees reports. When you block someone, they
            aren&apos;t told, and only you see the difference.
          </li>
          <li>
            Your study sessions (when each started and stopped) are visible only to you, unless you
            share one to a group when it ends, or choose in Settings → Sharing to share them all to
            one group. Then that group sees how long you studied and any note you added.
          </li>
          <li>
            <strong>Code analysis:</strong> Branch estimates each solution&apos;s complexity with
            its own analysis service, which runs on Vercel like the rest of Branch. It reads the
            code without running it and keeps nothing; the estimate is stored with your solution and
            shown only to you. No AI provider or other company sees your code. You can turn analysis
            off in Settings → Code analysis, which deletes your estimates.
          </li>
          <li>
            Members of your groups see your name, username, photo (unless you choose initials), and,
            for problems their group&apos;s plan assigns, whether you&apos;ve solved them. A post
            about a solve appears only if you turn on &quot;Share my solves&quot;.
          </li>
          <li>
            People don&apos;t read your data. The only exceptions are when you ask for help with
            your account, to investigate security problems or abuse, or when the law requires it.
          </li>
          <li>
            Branch runs on Vercel (hosting and uploaded photos) and Neon (database), which process
            data only to run the service. If you sign in with Google or GitHub, they handle that
            sign-in under their own policies. Data isn&apos;t shared with anyone else.
          </li>
        </ul>

        <h2>How long it&apos;s kept</h2>
        <ul>
          <li>Your account and what you create stay until you delete them or your account.</li>
          <li>
            An uploaded photo is deleted as soon as you replace it or switch to another photo.
          </li>
          <li>
            Your solutions (synced or pasted), their code, and their estimates stay until you delete
            them (Solutions). An estimate goes within a day of its solution, and at once if you turn
            analysis off.
          </li>
          <li>
            Study sessions stay until you delete them (Your stats). Deleting one also deletes the
            posts that shared it.
          </li>
          <li>
            A synced submission for a problem that isn&apos;t in Branch is deleted after 30 days
            unless the problem is added.
          </li>
          <li>
            Deleted posts, comments, and submissions are removed at once. The database host keeps
            short-lived backups for recovery, which expire on their own.
          </li>
        </ul>

        <h2>Your choices</h2>
        <ul>
          <li>Disconnect the extension from its popup or from Settings at any time.</li>
          <li>Delete any solution, or all of them, from Solutions.</li>
          <li>Turn code analysis off or on in Settings → Code analysis.</li>
          <li>Upload a photo, use the one from Google or GitHub, or show initials, in Settings.</li>
          <li>Turn sharing on or off, and delete your posts and comments, whenever you like.</li>
          <li>
            Report a post or comment to its group&apos;s admin, and block or unblock people
            (Settings → Blocked people).
          </li>
          <li>
            Choose in Settings → Sharing whether your code goes on your solve posts, and what
            happens to a study session when it ends: ask each time, always share to one group, or
            never.
          </li>
          <li>
            To delete your account and everything in it, or for any question about your data,{" "}
            {contactLine}.
          </li>
        </ul>

        <h2>Changes</h2>
        <p>
          If this policy changes, the new version appears here with a new effective date. Changes
          that affect what the extension collects are shown in the extension before they apply.
        </p>
      </main>
    </div>
  );
}
