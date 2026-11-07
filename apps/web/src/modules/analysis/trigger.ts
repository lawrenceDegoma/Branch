import "server-only";
import { after } from "next/server";
import { errorContext, logger } from "@/lib/logger";
import { runAnalysisJobs } from "./service";

/**
 * Runs a person's waiting analyses after a response has been sent (from `after()`), so saving a
 * solution never waits for it. Failures are logged; the daily job retries them.
 */
export async function analyzeSoon(userId: string) {
  try {
    await runAnalysisJobs({ userId, limit: 5 });
  } catch (error) {
    logger.error("background analysis failed", errorContext(error));
  }
}

/**
 * Schedules `analyzeSoon` for after the response. Outside a request (tests, scripts) there's
 * nothing to run after, so the daily job analyzes the solution instead; a sync or save never
 * fails because of it.
 */
export function analyzeAfterResponse(userId: string) {
  try {
    after(() => analyzeSoon(userId));
  } catch {
    // No request scope.
  }
}
