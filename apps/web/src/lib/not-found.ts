import "server-only";
import { notFound } from "next/navigation";
import { ForbiddenError, NotFoundError } from "./errors";

/**
 * Awaits a read and renders the 404 page when the viewer may not see it. Forbidden also maps to
 * 404 on pages, so admin-only URLs reveal nothing to members.
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) notFound();
    throw error;
  }
}
