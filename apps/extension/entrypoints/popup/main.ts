import { browser } from "wxt/browser";
import { BRANCH_ORIGIN } from "@/src/config";
import type { ConnectResult, ExtensionMessage, Status, TimerStatus } from "@/src/messages";
import { BUDGET_MAX, BUDGET_MIN } from "@/src/timer";
import { fillText } from "@/src/ui/disclosure";
import "@/src/ui/branch.css";

// The toolbar popup: connection, last sync, anything waiting, and what's sent.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const send = <T>(message: ExtensionMessage) => browser.runtime.sendMessage(message) as Promise<T>;

function ago(at: number) {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(at).toLocaleDateString();
}

function say(text: string, error = false) {
  const message = $("message");
  message.textContent = text;
  message.classList.toggle("error", error);
}

const STAGES = {
  submitted: "submitted, waiting for the verdict",
  "not-accepted": "not accepted, so nothing was sent",
  unidentified:
    "accepted, but Branch couldn't tell which LeetCode problem it is, so nothing was sent",
  accepted: "accepted",
} as const;

// Activity recorded before 1.1.0 has no site: it was always LeetCode.
const SITES = { LEETCODE: "LeetCode", NEETCODE: "neetcode.io" } as const;

function render(status: Status) {
  $("connected").hidden = !status.connection;
  $("disconnected").hidden = !!status.connection;
  $("what-is-sent").hidden = !status.connection;
  if (status.connection) {
    const { name, username } = status.connection;
    $("account").textContent = `Syncing to ${name}${username ? ` (@${username})` : ""}.`;
    $("last-seen").textContent = status.lastSeen
      ? `${status.lastSeen.slug} on ${SITES[status.lastSeen.site ?? "LEETCODE"]}, ${STAGES[status.lastSeen.stage]}, ${ago(status.lastSeen.at)}`
      : "Nothing yet";
    $("last-sync").textContent = status.lastSync
      ? `${status.lastSync.problemSlug}, ${status.lastSync.counted ? "counted" : "waiting for the problem to be added"}, ${ago(status.lastSync.at)}`
      : "Nothing yet";
    $("pending").textContent = status.queue.length ? String(status.queue.length) : "None";
    $("retry").hidden = status.queue.length === 0;
    $<HTMLInputElement>("budget").value = status.budgetMinutes ? String(status.budgetMinutes) : "";
    $("budget-off").hidden = status.budgetMinutes === null;
  }
  if (status.lastError) say(status.lastError.message, true);
}

async function refresh() {
  const status = await send<Status>({ type: "status" });
  render(status);
  if (status.connection) await showTimer();
}

/** The timer on the tab the popup opened over. */
async function showTimer() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const timer =
    tab?.id === undefined ? null : await send<TimerStatus>({ type: "timer", tabId: tab.id });
  const minutes = (n: number) => (n === 1 ? "1 minute" : `${n} minutes`);
  $("timer-now").textContent = !timer
    ? "This tab isn't on a problem."
    : timer.accepted
      ? `${timer.page}: accepted after ${minutes(timer.minutes)}.`
      : `${timer.page}: ${minutes(timer.minutes)} so far${timer.over ? ", past your budget" : ""}.`;
}

fillText();
$<HTMLAnchorElement>("privacy").href = `${BRANCH_ORIGIN}/privacy`;

$("open-settings").addEventListener("click", () => {
  void browser.tabs.create({ url: `${BRANCH_ORIGIN}/settings#extension` });
  window.close();
});

$<HTMLFormElement>("key-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = $<HTMLInputElement>("key").value.trim();
  if (!/^brx_[A-Za-z0-9_-]{43}$/.test(token)) {
    say("That doesn't look like a Branch key. Copy it again from Settings.", true);
    return;
  }
  say("Connecting…");
  const result = await send<ConnectResult>({ type: "connect", token });
  if (result.ok) {
    say(`Connected as ${result.name}.`);
    await refresh();
    $("disconnect").focus();
  } else say(result.message, true);
});

$("retry").addEventListener("click", async () => {
  say("Sending…");
  render(await send<Status>({ type: "retry" }));
  if (!$("message").classList.contains("error")) say("Sent.");
});

$<HTMLFormElement>("budget-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = Number($<HTMLInputElement>("budget").value);
  if (!Number.isInteger(value) || value < BUDGET_MIN || value > BUDGET_MAX) {
    say(`Choose a whole number of minutes from ${BUDGET_MIN} to ${BUDGET_MAX}.`, true);
    return;
  }
  render(await send<Status>({ type: "budget", minutes: value }));
  say(`Budget set to ${value} minutes.`);
  await showTimer();
});

$("budget-off").addEventListener("click", async () => {
  render(await send<Status>({ type: "budget", minutes: null }));
  say("Budget off.");
  $("budget").focus();
  await showTimer();
});

$("disconnect").addEventListener("click", async () => {
  render(await send<Status>({ type: "disconnect" }));
  say("Disconnected. Nothing more will sync from this browser.");
  $("open-settings").focus();
});

void refresh();
