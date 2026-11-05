import { browser } from "wxt/browser";
import { BRANCH_ORIGIN } from "@/src/config";
import type { ConnectResult, ExtensionMessage, Status } from "@/src/messages";
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
  accepted: "accepted",
} as const;

function render(status: Status) {
  $("connected").hidden = !status.connection;
  $("disconnected").hidden = !!status.connection;
  $("what-is-sent").hidden = !status.connection;
  if (status.connection) {
    const { name, username } = status.connection;
    $("account").textContent = `Syncing to ${name}${username ? ` (@${username})` : ""}.`;
    $("last-seen").textContent = status.lastSeen
      ? `${status.lastSeen.slug}, ${STAGES[status.lastSeen.stage]}, ${ago(status.lastSeen.at)}`
      : "Nothing yet";
    $("last-sync").textContent = status.lastSync
      ? `${status.lastSync.problemSlug}, ${status.lastSync.counted ? "counted" : "waiting for the problem to be added"}, ${ago(status.lastSync.at)}`
      : "Nothing yet";
    $("pending").textContent = status.queue.length ? String(status.queue.length) : "None";
    $("retry").hidden = status.queue.length === 0;
  }
  if (status.lastError) say(status.lastError.message, true);
}

async function refresh() {
  render(await send<Status>({ type: "status" }));
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

$("disconnect").addEventListener("click", async () => {
  render(await send<Status>({ type: "disconnect" }));
  say("Disconnected. Nothing more will sync from this browser.");
  $("open-settings").focus();
});

void refresh();
