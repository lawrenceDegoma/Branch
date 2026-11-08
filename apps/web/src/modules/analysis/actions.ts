"use server";

import { errorContext, logger } from "@/lib/logger";
import { requireViewer } from "@/modules/auth/session";
import { analysisState, runAnalysisJobs } from "./service";

/**
 * Runs a few of the viewer's waiting analyses now: new ones, retries, and estimates made by an
 * older analyzer version. Returns the viewer's analysis state afterwards, which Your solutions
 * compares with the state it was drawn with.
 */
export async function checkAnalysesAction(): Promise<{ fingerprint: string; pending: number }> {
  const { user } = await requireViewer();
  try {
    await runAnalysisJobs({ userId: user.id, limit: 5 });
  } catch (error) {
    logger.error("analysis check failed", errorContext(error));
  }
  return analysisState(user.id);
}
