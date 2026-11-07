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

export type ExtensionMessage =
  | { type: "submission"; payload: SubmissionPayload }
  | { type: "activity"; activity: Activity }
  | { type: "connect"; token: string }
  | { type: "disconnect" }
  | { type: "status" }
  | { type: "retry" };

export type ConnectResult = { ok: true; name: string } | { ok: false; message: string };

export type Status = {
  connection: ConnectionResponse | null;
  queue: QueueItem[];
  lastSync: { at: number; problemSlug: string; counted: boolean } | null;
  lastError: { at: number; message: string } | null;
  /** Stored before 1.1.0 without a site (it was always LeetCode). */
  lastSeen: (Omit<Activity, "site"> & { site?: Activity["site"]; at: number }) | null;
};

/** Page script → relay content script on leetcode.com or neetcode.io, via window.postMessage. */
export const OBSERVER_MESSAGE = "branch-extension:submission";
