import type { SubmissionPayload } from "@branch/shared/extension";
import { browser, type Browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { fetchConnection, revokeConnection, sendSubmission } from "@/src/api";
import { BRANCH_ORIGIN, SITE_BY_ORIGIN } from "@/src/config";
import type {
  Activity,
  ConnectResult,
  ExtensionMessage,
  PageReport,
  Status,
  TimerStatus,
} from "@/src/messages";
import { enqueue, retryDelayMinutes, sameSubmission, type QueueItem } from "@/src/queue";
import {
  accept,
  badge,
  BUDGET_MAX,
  BUDGET_MIN,
  observe,
  spentMs,
  type PageTimer,
} from "@/src/timer";

// Holds the connection and a queue of accepted submissions, and sends them to Branch. The
// service worker can stop at any time, so everything lives in storage.local and retries are
// scheduled with alarms. Nothing is collected while disconnected.
//
// It also keeps a problem timer per tab (in storage.session, gone when the browser closes): the
// tab's minutes show on the toolbar badge, and an accepted submission from that tab carries the
// time. Timers run only while connected.

const RETRY_ALARM = "branch-retry";

type Stored = {
  connection: { token: string; name: string; username: string | null } | null;
  queue: QueueItem[];
  lastSync: Status["lastSync"];
  lastError: Status["lastError"];
  lastSeen: Status["lastSeen"];
  budgetMinutes: number | null;
};

const defaults: Stored = {
  connection: null,
  queue: [],
  lastSync: null,
  lastError: null,
  lastSeen: null,
  budgetMinutes: null,
};

async function read(): Promise<Stored> {
  return { ...defaults, ...((await browser.storage.local.get(defaults)) as Partial<Stored>) };
}

const write = (changes: Partial<Stored>) => browser.storage.local.set(changes);

async function status(): Promise<Status> {
  const { connection, queue, lastSync, lastError, lastSeen, budgetMinutes } = await read();
  return {
    connection: connection ? { name: connection.name, username: connection.username } : null,
    queue,
    lastSync,
    lastError,
    lastSeen,
    budgetMinutes,
  };
}

// --- The problem timer ---------------------------------------------------------------------

type Timers = Record<string, PageTimer>;

const NEUTRAL = "#5f6368"; // 6:1 with white text
const OVER_BUDGET = "#b45309"; // amber; 5:1 with white text

/** Reads and updates the timers one change at a time (messages arrive concurrently). */
let timerQueue: Promise<unknown> = Promise.resolve();
function withTimers<T>(change: (timers: Timers) => T | Promise<T>): Promise<T> {
  const run = timerQueue.then(async () => {
    const { timers = {} } = (await browser.storage.session.get("timers")) as { timers?: Timers };
    const result = await change(timers);
    await browser.storage.session.set({ timers });
    return result;
  });
  timerQueue = run.catch(() => {});
  return run;
}

async function showBadge(tabId: number, timer: PageTimer | undefined) {
  const { budgetMinutes } = await read();
  const { text, over } = badge(timer, budgetMinutes, Date.now());
  try {
    await browser.action.setBadgeText({ tabId, text });
    if (text) {
      await browser.action.setBadgeBackgroundColor({ tabId, color: over ? OVER_BUDGET : NEUTRAL });
      await browser.action.setBadgeTextColor({ tabId, color: "#ffffff" });
    }
  } catch {
    // The tab closed in the meantime.
  }
}

/** A problem tab reported in. Ignored while disconnected (nothing is collected then). */
async function onPage(tabId: number, report: PageReport) {
  const { connection } = await read();
  if (!connection) return;
  const timer = await withTimers((timers) => {
    const next = observe(timers[tabId], report, Date.now());
    if (next) timers[tabId] = next;
    else delete timers[tabId];
    return next;
  });
  await showBadge(tabId, timer);
}

/**
 * The time to send with an accepted submission from `tabId`, stopping that tab's timer. On
 * LeetCode the page must be the same problem; neetcode.io's pages use its own names, so there
 * it's the tab's current problem.
 */
async function timeSpent(tabId: number, payload: SubmissionPayload) {
  const result = await withTimers((timers) => {
    const timer = timers[tabId];
    if (!timer) return null;
    if (payload.source === "LEETCODE" && timer.page !== payload.problemSlug) return null;
    const accepted = accept(timer, Date.now());
    timers[tabId] = accepted.timer;
    return accepted;
  });
  if (result) await showBadge(tabId, result.timer);
  return result?.seconds ?? null;
}

async function timerStatus(tabId: number): Promise<TimerStatus> {
  const { budgetMinutes } = await read();
  const { timers = {} } = (await browser.storage.session.get("timers")) as { timers?: Timers };
  const timer = timers[tabId];
  if (!timer) return null;
  const now = Date.now();
  return {
    page: timer.page,
    minutes: Math.floor(spentMs(timer, now) / 60_000),
    accepted: timer.acceptedAt !== null,
    over: badge(timer, budgetMinutes, now).over,
  };
}

async function setBudget(minutes: number | null) {
  const valid =
    minutes === null ||
    (Number.isInteger(minutes) && minutes >= BUDGET_MIN && minutes <= BUDGET_MAX);
  if (!valid) return;
  await write({ budgetMinutes: minutes });
  const { timers = {} } = (await browser.storage.session.get("timers")) as { timers?: Timers };
  for (const [tabId, timer] of Object.entries(timers)) await showBadge(Number(tabId), timer);
}

async function clearTimers() {
  const { timers = {} } = (await browser.storage.session.get("timers")) as { timers?: Timers };
  await browser.storage.session.remove("timers");
  for (const tabId of Object.keys(timers)) await showBadge(Number(tabId), undefined);
}

// --- Submissions ---------------------------------------------------------------------------

async function add(payload: SubmissionPayload, tabId: number | undefined) {
  const { connection } = await read();
  if (!connection) return;
  const seconds = tabId === undefined ? null : await timeSpent(tabId, payload);
  // Only this timer sets the time, never the page (undefined is left out when it's sent).
  const timed = { ...payload, timeSpentSeconds: seconds ?? undefined };
  const { queue } = await read();
  await write({
    queue: enqueue(queue, timed, Date.now()),
    lastSeen: {
      site: payload.source,
      stage: "accepted",
      slug: payload.problemSlug,
      at: Date.now(),
    },
  });
  await flush();
}

/** Notes what was last seen on LeetCode or neetcode.io, for the popup. Nothing while disconnected. */
async function seen(activity: Activity) {
  const { connection } = await read();
  if (connection) await write({ lastSeen: { ...activity, at: Date.now() } });
}

let flushing: Promise<void> | null = null;

/** Sends what's queued, one at a time. Concurrent calls share the run in progress. */
function flush(): Promise<void> {
  flushing ??= (async () => {
    try {
      for (;;) {
        const { connection, queue } = await read();
        const item = queue[0];
        if (!connection || !item) return;
        const outcome = await sendSubmission(connection.token, item.payload);
        const remaining = (await read()).queue.filter((queued) => !sameSubmission(queued, item));
        if (outcome.kind === "ok") {
          await write({
            queue: remaining,
            lastSync: {
              at: Date.now(),
              problemSlug: item.payload.problemSlug,
              counted: outcome.result.counted,
            },
            lastError: null,
          });
        } else if (outcome.kind === "rejected") {
          await write({
            queue: remaining,
            lastError: { at: Date.now(), message: outcome.message },
          });
        } else if (outcome.kind === "unauthorized") {
          // Disconnected from Branch's side: stop, and drop what was waiting.
          await write({
            connection: null,
            queue: [],
            lastError: {
              at: Date.now(),
              message: "Disconnected in Branch. Connect again to sync.",
            },
          });
          return;
        } else {
          const attempts = item.attempts + 1;
          await write({
            queue: [{ ...item, attempts }, ...remaining],
            lastError: { at: Date.now(), message: outcome.message },
          });
          await browser.alarms.create(RETRY_ALARM, { delayInMinutes: retryDelayMinutes(attempts) });
          return;
        }
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

async function connect(token: string): Promise<ConnectResult> {
  let account;
  try {
    account = await fetchConnection(token);
  } catch {
    return { ok: false, message: "Couldn't reach Branch. Check your connection and try again." };
  }
  if (!account)
    return { ok: false, message: "Branch didn't accept that key. Create a new one in Settings." };
  await write({
    connection: { token, name: account.name, username: account.username },
    queue: [],
    lastError: null,
  });
  return { ok: true, name: account.name };
}

async function disconnect() {
  const { connection } = await read();
  await write({ connection: null, queue: [], lastSync: null, lastError: null, lastSeen: null });
  await browser.alarms.clear(RETRY_ALARM);
  await clearTimers();
  if (connection) await revokeConnection(connection.token);
}

/**
 * Who may send what: submissions and activity only from a tab on the site they name (leetcode.com
 * or neetcode.io), connecting only from Branch or the popup.
 */
function allowed(message: ExtensionMessage, sender: Browser.runtime.MessageSender) {
  if (sender.id !== browser.runtime.id) return false;
  const from = sender.url ? new URL(sender.url).origin : "";
  const popup = sender.url?.startsWith(browser.runtime.getURL("/")) ?? false;
  const site = SITE_BY_ORIGIN[from as keyof typeof SITE_BY_ORIGIN];
  switch (message.type) {
    case "submission":
      return site === message.payload.source && sender.tab !== undefined;
    case "activity":
      return site === message.activity.site && sender.tab !== undefined;
    case "page":
      return (
        site === message.report.site &&
        sender.tab?.id !== undefined &&
        (message.report.page === null || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(message.report.page))
      );
    case "connect":
      return popup || (from === BRANCH_ORIGIN && sender.tab !== undefined);
    default:
      return popup;
  }
}

async function respond(
  message: ExtensionMessage,
  sender: Browser.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case "submission":
      await add(message.payload, sender.tab?.id);
      return null;
    case "page":
      await onPage(sender.tab!.id!, message.report);
      return null;
    case "timer":
      return timerStatus(message.tabId);
    case "budget":
      await setBudget(message.minutes);
      return status();
    case "activity":
      await seen(message.activity);
      return null;
    case "connect": {
      const result = await connect(message.token);
      await flush();
      return result;
    }
    case "disconnect":
      await disconnect();
      return status();
    case "retry":
      await flush();
      return status();
    case "status":
      return status();
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    if (!allowed(message, sender)) return false;
    respond(message, sender).then(sendResponse, () => sendResponse(null));
    return true; // the response is async
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RETRY_ALARM) void flush();
  });
  browser.runtime.onStartup.addListener(() => void flush());
  browser.tabs.onRemoved.addListener((tabId) => {
    void withTimers((timers) => {
      delete timers[tabId];
    });
  });
  // A first install opens the welcome page: what the extension does and sends, before connecting.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install")
      void browser.tabs.create({ url: browser.runtime.getURL("/welcome.html") });
  });
});
