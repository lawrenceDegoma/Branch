import { DomainError } from "@/lib/errors";
import { errorContext, logger } from "@/lib/logger";
import { analyzeAfterResponse } from "@/modules/analysis/trigger";
import { authenticateExtension } from "@/modules/integrations/connections";
import { apiError, json, unauthorized } from "@/modules/integrations/http";
import { SUBMISSION_BODY_MAX_BYTES, submissionPayloadSchema } from "@/modules/integrations/schemas";
import { ingestSubmission } from "@/modules/integrations/submissions";

/** The extension reports one accepted submission. Idempotent per site and submission ID. */
export async function POST(request: Request) {
  const auth = await authenticateExtension(request.headers.get("authorization"));
  if (!auth) return unauthorized();

  const text = await request.text();
  if (text.length > SUBMISSION_BODY_MAX_BYTES) {
    return apiError(413, "TOO_LARGE", "That submission is too large to sync.");
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return apiError(400, "INVALID", "The request wasn't valid JSON.");
  }
  const parsed = submissionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    return apiError(400, "INVALID", `Invalid fields: ${fields.join(", ") || "body"}.`);
  }

  try {
    const result = await ingestSubmission(auth.userId, parsed.data);
    // Analysis never holds up syncing: it runs after the response is sent.
    if (result.stored === "new") analyzeAfterResponse(auth.userId);
    return json(result);
  } catch (error) {
    if (error instanceof DomainError) {
      return apiError(error.code === "RATE_LIMITED" ? 429 : 400, error.code, error.message);
    }
    logger.error("extension submission failed", {
      connectionId: auth.connectionId,
      ...errorContext(error),
    });
    return apiError(500, "SERVER_ERROR", "Branch couldn't save that. It will be retried.");
  }
}
