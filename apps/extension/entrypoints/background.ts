import type { SubmissionPayload } from "@branch/shared/extension";
import { browser, type Browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { fetchConnection, revokeConnection, sendSubmission } from "@/src/api";
import { BRANCH_ORIGIN, LEETCODE_ORIGIN } from "@/src/config";
import type { Activity, ConnectResult, ExtensionMessage, Status } from "@/src/messages";
import { enqueue, retryDelayMinutes, type QueueItem } from "@/src/queue";

// Holds the connection and a queue of accepted submissions, and sends them to Branch. The
// service worker can stop at any time, so everything lives in storage.local and retries are
// scheduled with alarms. Nothing is collected while disconnected.

const RETRY_ALARM = "branch-retry";

type Stored = {
  connection: { token: string; name: string; username: string | null } | null;
  queue: QueueItem[];
  lastSync: Status["lastSync"];
  lastError: Status["lastError"];
  lastSeen: Status["lastSeen"];
};

const defaults: Stored = {
  connection: null,
  queue: [],
  lastSync: null,
  lastError: null,
  lastSeen: null,
};

async function read(): Promise<Stored> {
  return { ...defaults, ...((await browser.storage.local.get(defaults)) as Partial<Stored>) };
}

const write = (changes: Partial<Stored>) => browser.storage.local.set(changes);

async function status(): Promise<Status> {
  const { connection, queue, lastSync, lastError, lastSeen } = await read();
  return {
    connection: connection ? { name: connection.name, username: connection.username } : null,
    queue,
    lastSync,
    lastError,
    lastSeen,
  };
}

async function add(payload: SubmissionPayload) {
  const { connection, queue } = await read();
  if (!connection) return;
  await write({
    queue: enqueue(queue, payload, Date.now()),
    lastSeen: { stage: "accepted", slug: payload.problemSlug, at: Date.now() },
  });
  await flush();
}

/** Notes what was last seen on LeetCode, for the popup. Nothing while disconnected. */
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
        const remaining = (await read()).queue.filter(
          (queued) => queued.payload.submissionId !== item.payload.submissionId,
        );
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
  if (connection) await revokeConnection(connection.token);
}

/** Who may send what: submissions only from leetcode.com, connecting from Branch or the popup. */
function allowed(message: ExtensionMessage, sender: Browser.runtime.MessageSender) {
  if (sender.id !== browser.runtime.id) return false;
  const from = sender.url ? new URL(sender.url).origin : "";
  const popup = sender.url?.startsWith(browser.runtime.getURL("/")) ?? false;
  switch (message.type) {
    case "submission":
    case "activity":
      return from === LEETCODE_ORIGIN && sender.tab !== undefined;
    case "connect":
      return popup || (from === BRANCH_ORIGIN && sender.tab !== undefined);
    default:
      return popup;
  }
}

async function respond(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "submission":
      await add(message.payload);
      return null;
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
    respond(message).then(sendResponse, () => sendResponse(null));
    return true; // the response is async
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RETRY_ALARM) void flush();
  });
  browser.runtime.onStartup.addListener(() => void flush());
  // A first install opens the welcome page: what the extension does and sends, before connecting.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install")
      void browser.tabs.create({ url: browser.runtime.getURL("/welcome.html") });
  });
});
