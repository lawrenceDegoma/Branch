import type {
  ConnectionResponse,
  SubmissionPayload,
  SubmissionSite,
} from "@branch/shared/extension";
import type { QueueItem } from "./queue";

// Messages inside the extension (content scripts and popup → background).

/** What the extension last saw on LeetCode or neetcode.io; never any code. */
export type Activity = {
  site: SubmissionSite;
  stage: "submitted" | "not-accepted" | "unidentified" | "accepted";
  slug: string;
};

/** A problem tab reporting in for the timer: which problem page it's on (if any), and whether in view. */
export type PageReport = {
  site: SubmissionSite;
  page: string | null;
  visible: boolean;
  /** The first report since the page loaded. */
  loaded: boolean;
};

export type ExtensionMessage =
  | { type: "submission"; payload: SubmissionPayload }
  | { type: "activity"; activity: Activity }
  | { type: "page"; report: PageReport }
  | { type: "timer"; tabId: number }
  | { type: "budget"; minutes: number | null }
  | { type: "connect"; token: string }
  | { type: "disconnect" }
  | { type: "status" }
  | { type: "retry" };

/** The problem timer on one tab, for the popup. */
export type TimerStatus = {
  page: string;
  minutes: number;
  accepted: boolean;
  over: boolean;
} | null;

export type ConnectResult = { ok: true; name: string } | { ok: false; message: string };

export type Status = {
  connection: ConnectionResponse | null;
  queue: QueueItem[];
  lastSync: { at: number; problemSlug: string; counted: boolean } | null;
  lastError: { at: number; message: string } | null;
  /** The problem timer's budget, in minutes; null when off. */
  budgetMinutes: number | null;
  /** Stored before 1.1.0 without a site (it was always LeetCode). */
  lastSeen: (Omit<Activity, "site"> & { site?: Activity["site"]; at: number }) | null;
};

/** Page script → relay content script on leetcode.com or neetcode.io, via window.postMessage. */
export const OBSERVER_MESSAGE = "branch-extension:submission";
