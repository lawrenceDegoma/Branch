// What's new in Branch, newest first: one entry per update people can see, added in the same
// commit as the update. `summary` is the line on Home's card; `details` (Markdown, rendered
// without raw HTML) is the entry's own page. IDs are permanent: a date and a slug.

export type ChangelogEntry = {
  id: string;
  /** The day it shipped (YYYY-MM-DD). */
  date: string;
  title: string;
  summary: string;
  details: string;
};

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: "2026-11-11-terms-of-service",
    date: "2026-11-11",
    title: "Terms of service",
    summary: "Branch now has terms of service, next to the privacy policy.",
    details: `The terms of service set out the rules for using Branch and its extension, in plain language: you must be 13 or older, you keep ownership of what you post, how to use Branch fairly, and that estimates and statistics are approximate.

Find them at the bottom of the sign-in pages and Settings, next to the privacy policy. Signing up now says that continuing means agreeing to both.`,
  },
  {
    id: "2026-11-10-reporting-and-blocking",
    date: "2026-11-10",
    title: "Reporting and blocking",
    summary: "Report a post or comment to your group's admin, or block someone.",
    details: `Use the ⋯ menu on someone else's post or comment.

- **Report** it to the group's admin, with a reason and an optional note. The admin can remove it or keep it up; nobody sees that the report was yours.
- **Block** its author. Their posts, comments, and reactions are hidden for you (you can still look), and they can't comment on your posts or reply to you. They aren't told, and you both stay in your groups.

Group admins find reports in the group's settings. Unblock people in Settings → Blocked people.`,
  },
  {
    id: "2026-11-09-your-stats",
    date: "2026-11-09",
    title: "Your stats",
    summary: "A private page of your progress over time: solves, study time, topics, and reviews.",
    details: `Open **Your stats** from "Your week" on Home, or from Review.

- **Solving:** how many problems you've solved, by difficulty, and each week for the last 12 weeks.
- **Time:** how long you studied each week, and your typical time per problem by difficulty, from the extension's problem timer.
- **Topics:** how much of each topic you've solved, and which ones Review suggests practising.
- **Reviews:** how your reviews went in the last 30 days.
- **Study sessions:** your latest sessions, which you can delete.

Only you see this page. There are no streaks, rankings, or comparisons with anyone.`,
  },
  {
    id: "2026-11-09-problem-timer",
    date: "2026-11-09",
    title: "A problem timer in the extension",
    summary: "The extension times each problem you work on, with an optional time budget.",
    details: `Version 1.2.0 of the extension counts the minutes you spend on a problem in each tab, on leetcode.com or neetcode.io, while the tab is in view. The toolbar button shows them.

- Set a time budget in the extension's popup, and the button turns amber once you're past it. There's no sound or pop-up.
- When your submission is accepted, the time goes to Branch with it. Your Solutions tab shows about how long each one took; only you see it.
- Time with the tab in the background, or the computer asleep, doesn't count.

It arrives once Chrome updates the extension, after the Chrome Web Store reviews it.`,
  },
  {
    id: "2026-11-09-study-timer",
    date: "2026-11-09",
    title: "A study timer",
    summary: "Time your study sessions from Home, and share one with a group if you like.",
    details: `Press **Start studying** above "Your week" on Home, and **Stop studying** when you're done. The timer keeps going if you reload or switch devices.

- When you stop, Branch asks whether to share the session to one of your groups, with an optional note. It shows there as "Studied for 45 min". Nothing is shared unless you choose to.
- Tick **Remember my decision** to always share to that group, or never share, without being asked. Change it any time in Settings → Sharing.
- A session counts at most 4 hours. If you forget to stop the timer, it stops counting there and asks before sharing anything.
- Sessions under a minute aren't kept.`,
  },
  {
    id: "2026-11-09-whats-new",
    date: "2026-11-09",
    title: "What's new",
    summary: "Branch now tells you about updates: a card on Home, and a page for each one.",
    details: `When Branch changes, a card on Home says what's new the next time you visit, with a link to the details. Dismiss it and it stays gone until the next update.

Every update so far is listed on the What's new page, starting with Branch's launch.`,
  },
  {
    id: "2026-11-09-code-on-solve-posts",
    date: "2026-11-09",
    title: "Your code on your solve posts, if you want",
    summary: "A new setting adds your synced code to your solve posts, folded as a spoiler.",
    details: `Turn on **Add my code to my solve posts** in Settings → Sharing (it needs **Share my solves**). When the extension syncs a solve, its post shows your code to the group, folded until someone opens it.

- It's off unless you turn it on.
- Turning it off takes your code off every solve post at once, and deleting a solution takes it off its post.
- Solves you mark by hand have no code, and code longer than a post (5,000 characters) isn't added. You can still share any solution yourself from Solutions.
- The complexity estimate is never added.`,
  },
  {
    id: "2026-11-09-sign-in-and-photos",
    date: "2026-11-09",
    title: "Sign in with Google or GitHub, and profile photos",
    summary: "New accounts sign in with Google or GitHub, and everyone can choose a photo.",
    details: `**Signing in:** new accounts use Google or GitHub. If you made a password account before, Branch asks you to connect Google or GitHub once; your groups, progress, and solutions stay, and the password is switched off.

**Photos:** your photo from Google or GitHub shows next to your name by default, and stays current. In Settings you can upload your own instead, or show your initials.`,
  },
  {
    id: "2026-11-09-solved-again-and-badges",
    date: "2026-11-09",
    title: '"Solved it again" posts, and badges',
    summary: "Re-solving a problem can post again, and milestones earn badges.",
    details: `**Solved it again:** with **Share my solves** on, solving a problem again (synced by the extension) posts "Solved it again", at most once a week per problem.

**Badges:** milestones like your first solve or your first finished week earn a badge, kept once earned. Your groups see your top badges next to your name while you share your solves. There are no streaks.`,
  },
  {
    id: "2026-11-07-code-analysis",
    date: "2026-11-07",
    title: "Code analysis, and pasting your solutions",
    summary: "Your Python solutions get a private estimate of their time and space complexity.",
    details: `Each Python solution, synced or pasted, gets an estimate like "probably O(n) time and O(n) space", with how confident it is, the reasons, and what reading code can't tell. Branch reads the code without running it, and no AI provider sees it.

- Estimates are only for you, and never change your reviews or suggestions.
- No extension? Paste your solution to a problem you've solved, on the Solutions tab.
- Share a solution with a group yourself, with or without its code.
- Turn analysis off in Settings → Code analysis, which deletes your estimates.`,
  },
  {
    id: "2026-11-07-practice-suggestions",
    date: "2026-11-07",
    title: "Practice suggestions",
    summary: "Topics you keep struggling with get new problems to practise, easiest first.",
    details: `When your reviews in a topic keep going badly, Review suggests unsolved problems in that topic, easiest first, and says why. Solve one and it counts like any other solve. Only you see your topics and suggestions.`,
  },
  {
    id: "2026-11-07-neetcode-io",
    date: "2026-11-07",
    title: "The extension syncs from neetcode.io too",
    summary: "Accepted submissions on neetcode.io now count, like LeetCode's.",
    details: `Version 1.1.0 of the extension also watches your submissions on neetcode.io. An accepted one is matched to its LeetCode problem and marked solved in Branch, the same as on leetcode.com.`,
  },
  {
    id: "2026-11-06-reviews",
    date: "2026-11-06",
    title: "Reviews",
    summary: "Problems you've solved come back on a schedule, so they stick.",
    details: `Each problem you solve comes back for review a few days later. Rate how it went (couldn't solve, struggled, solved, or easy) and Branch sets when it returns: sooner if it was hard, later if it was easy. Your reviews are private, and they never change your progress.`,
  },
  {
    id: "2026-11-06-chrome-extension",
    date: "2026-11-06",
    title: "The Chrome extension",
    summary: "Branch for LeetCode marks problems solved when LeetCode accepts your submission.",
    details: `Install **Branch for LeetCode** from the Chrome Web Store and connect it in Settings. When LeetCode accepts one of your submissions, it's marked solved in Branch, once, with no clicking.

- Your code is kept privately on your Solutions tab, and you can delete it any time.
- The extension only watches your own submissions' results; it never changes LeetCode's pages or asks it for anything.
- Marking problems solved by hand still works.`,
  },
  {
    id: "2026-11-04-social-feed",
    date: "2026-11-04",
    title: "The feed: posts, code, reactions, and comments",
    summary: "Your groups now have a feed for questions, code, and celebrating solves.",
    details: `Home is now a feed of everything happening in your groups.

- **Posts:** ask for help or share a tip, with code blocks highlighted, and spoilers folded until opened.
- **Automatic posts:** with **Share my solves** on (off by default), solving a problem from your group's plan posts it, along with finished weeks and plans.
- **Reactions and comments:** kudos, impressive, helpful, or same here, and threaded replies.`,
  },
  {
    id: "2026-11-03-launch",
    date: "2026-11-03",
    title: "Branch launches",
    summary: "Groups, shared roadmaps, weekly plans, and progress you track together.",
    details: `Branch is a place to work through interview problems with friends.

- Create a group and invite friends with a link.
- Pick a roadmap (Patterns 150, Essentials 75, or your own) and a weekly pace.
- Everyone sees the same problems each week; mark them solved and see who's done what. Falling behind leaves a backlog, and you can always work ahead.
- A problem you solve counts once, in every group and roadmap it appears in.`,
  },
];
