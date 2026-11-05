import type { ConnectionResponse, SubmissionPayload } from "@branch/shared/extension";
import type { QueueItem } from "./queue";

// Messages inside the extension (content scripts and popup → background).

/** What the extension last saw on LeetCode; never any code. */
export type Activity = { stage: "submitted" | "not-accepted" | "accepted"; slug: string };

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
  lastSeen: (Activity & { at: number }) | null;
};

/** Page script → relay content script on leetcode.com, via window.postMessage. */
export const OBSERVER_MESSAGE = "branch-extension:submission";
