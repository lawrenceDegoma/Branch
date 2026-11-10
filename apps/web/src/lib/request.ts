import "server-only";
import { headers } from "next/headers";

// Per-request identity, set by src/proxy.ts: a request ID on every request and response (quoted
// in log lines and error records, so one can be found from the other) and the CSP nonce.

export const REQUEST_ID_HEADER = "x-request-id";
export const NONCE_HEADER = "x-nonce";

/** The current request's ID, or null outside a request (the daily job, a script). */
export async function requestId(): Promise<string | null> {
  try {
    return (await headers()).get(REQUEST_ID_HEADER);
  } catch {
    return null;
  }
}

/** The current request's CSP nonce, for inline scripts (next-themes); null outside a request. */
export async function cspNonce(): Promise<string | null> {
  try {
    return (await headers()).get(NONCE_HEADER);
  } catch {
    return null;
  }
}
