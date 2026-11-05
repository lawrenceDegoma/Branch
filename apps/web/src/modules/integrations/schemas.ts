import { z } from "zod";

export {
  SUBMISSION_BODY_MAX_BYTES,
  SUBMISSION_CODE_MAX,
  submissionPayloadSchema,
  type SubmissionPayload,
} from "@branch/shared/extension";

export const connectionIdSchema = z.uuid();
export const submissionIdSchema = z.uuid();
