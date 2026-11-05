import type {
  ApiErrorResponse,
  ConnectionResponse,
  IngestResponse,
  SubmissionPayload,
} from "@branch/shared/extension";
import { BRANCH_ORIGIN } from "./config";

// Branch's extension API. Every outcome is classified so the queue knows whether to keep,
// drop, or retry an item; nothing here throws.

export type SendOutcome =
  | { kind: "ok"; result: IngestResponse }
  | { kind: "unauthorized" }
  /** Branch refused this payload for good (invalid, too large): retrying won't help. */
  | { kind: "rejected"; message: string }
  /** Rate limited, a server error, or offline: try again later. */
  | { kind: "retry"; message: string };

type Fetch = typeof fetch;

const headers = (token: string) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
});

async function errorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as Partial<ApiErrorResponse>;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function sendSubmission(
  token: string,
  payload: SubmissionPayload,
  fetchFn: Fetch = fetch,
): Promise<SendOutcome> {
  let response: Response;
  try {
    response = await fetchFn(`${BRANCH_ORIGIN}/api/extension/submissions`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(payload),
    });
  } catch {
    return { kind: "retry", message: "Couldn't reach Branch." };
  }
  if (response.ok) return { kind: "ok", result: (await response.json()) as IngestResponse };
  if (response.status === 401) return { kind: "unauthorized" };
  if (response.status === 429 || response.status >= 500) {
    return { kind: "retry", message: await errorMessage(response, "Branch is busy.") };
  }
  return { kind: "rejected", message: await errorMessage(response, "Branch refused it.") };
}

/** Who a token belongs to, or null if Branch doesn't accept it. Throws only when offline. */
export async function fetchConnection(
  token: string,
  fetchFn: Fetch = fetch,
): Promise<ConnectionResponse | null> {
  const response = await fetchFn(`${BRANCH_ORIGIN}/api/extension/connection`, {
    headers: headers(token),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Branch answered ${response.status}`);
  return (await response.json()) as ConnectionResponse;
}

/** Revokes the token on Branch. Best effort: disconnecting locally happens regardless. */
export async function revokeConnection(token: string, fetchFn: Fetch = fetch) {
  try {
    await fetchFn(`${BRANCH_ORIGIN}/api/extension/connection`, {
      method: "DELETE",
      headers: headers(token),
    });
  } catch {
    // Offline: the token stays valid on Branch until it's disconnected in Settings.
  }
}
