import type { Instrumentation } from "next";

// Next calls this for every unexpected error while rendering a page, running a server action, or
// handling a route (not for notFound() or redirect()). The record goes to the error table so it
// outlives Vercel's one-hour logs; the digest Next gives the error page is stored with it.

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // This file is built for the edge runtime too, where Prisma can't run: Next drops the branch
  // for the other runtime at build time, so the import stays out of the edge bundle.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { describeError, recordError } = await import("@/modules/errors/service");
    await recordError(describeError(error, request, context.routeType));
  }
};
