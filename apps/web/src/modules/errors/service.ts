import "server-only";
import { prisma } from "@branch/database";

// Unexpected server errors, kept in a small table (owner decision, 2026-11-10) because Vercel
// Hobby keeps runtime logs for an hour. A record says where and what, never a request body,
// code, or message text. Written by src/instrumentation.ts; read with `pnpm errors`; rows older
// than KEEP_DAYS go with the daily job.

export const KEEP_DAYS = 14;
const MESSAGE_MAX = 2000;
const STACK_MAX = 4000;
const PATH_MAX = 500;

export type ErrorRecord = {
  requestId: string | null;
  digest: string | null;
  path: string;
  method: string;
  routeType: string;
  name: string;
  message: string;
  stack: string | null;
};

/** What to store about an error: bounded, and the path without its query string. */
export function describeError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  routeType: string,
): ErrorRecord {
  const err = error instanceof Error ? error : null;
  const digest = (error as { digest?: unknown } | null)?.digest;
  const requestIdHeader = request.headers["x-request-id"];
  return {
    requestId: typeof requestIdHeader === "string" ? requestIdHeader.slice(0, 100) : null,
    digest: typeof digest === "string" ? digest.slice(0, 100) : null,
    path: request.path.split("?")[0]!.slice(0, PATH_MAX),
    method: request.method.slice(0, 10),
    routeType: routeType.slice(0, 20),
    name: (err?.name ?? "Error").slice(0, 200),
    message: (err?.message ?? String(error)).slice(0, MESSAGE_MAX),
    stack: err?.stack ? err.stack.slice(0, STACK_MAX) : null,
  };
}

/** Records an error. Never throws: an error while recording must not hide the original. */
export async function recordError(record: ErrorRecord): Promise<void> {
  try {
    await prisma.serverError.create({ data: record });
  } catch (cause) {
    console.error(
      JSON.stringify({
        time: new Date().toISOString(),
        level: "error",
        message: "could not record error",
        errorName: cause instanceof Error ? cause.name : "Error",
      }),
    );
  }
}

/** Deletes records older than KEEP_DAYS. Idempotent; the daily job runs it. */
export async function purgeServerErrors(now = new Date()): Promise<number> {
  const { count } = await prisma.serverError.deleteMany({
    where: { at: { lt: new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000) } },
  });
  return count;
}
