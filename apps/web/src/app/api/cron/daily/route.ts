import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { errorContext, logger } from "@/lib/logger";
import { deleteUnusedResults, runAnalysisJobs } from "@/modules/analysis/service";
import { json } from "@/modules/integrations/http";
import {
  matchWaitingSubmissions,
  purgeExpiredSubmissions,
} from "@/modules/integrations/submissions";

// Vercel runs this once a day (vercel.json), sending `Authorization: Bearer <CRON_SECRET>`.
// Delivery is best effort and can repeat, so each step is idempotent and catches up on
// whatever earlier runs missed.

function authorized(header: string | null) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return json({ error: "unauthorized" }, 401);
  }
  try {
    const matched = await matchWaitingSubmissions();
    const purged = await purgeExpiredSubmissions();
    // Anything not yet analyzed: new solutions the immediate run missed, and retries.
    const analysis = await runAnalysisJobs({ limit: 200 });
    const unusedResults = await deleteUnusedResults();
    logger.info("daily job finished", { matched, purged, unusedResults, ...analysis });
    return json({ matched, purged, unusedResults, analysis });
  } catch (error) {
    logger.error("daily job failed", errorContext(error));
    return json({ error: "failed" }, 500);
  }
}
