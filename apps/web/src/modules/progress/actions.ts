"use server";

import { revalidatePath } from "next/cache";
import { DomainError } from "@/lib/errors";
import { takeToken } from "@/lib/limits";
import { errorContext, logger } from "@/lib/logger";
import { requireViewer } from "@/modules/auth/session";
import { completionInputSchema } from "./schemas";
import { setCompletion } from "./service";

export type CompletionResult = { ok: true } | { ok: false; message: string };

/** Marks a problem solved or unsolved for the signed-in user. */
const COMPLETIONS_PER_MINUTE = 60;

export async function setCompletionAction(
  problemId: string,
  solved: boolean,
): Promise<CompletionResult> {
  const { user } = await requireViewer();
  const parsed = completionInputSchema.safeParse({ problemId, solved });
  if (!parsed.success) return { ok: false, message: "We couldn't find that problem." };
  try {
    // Each toggle is idempotent; this bounds the writes (and automatic posts) a loop could make.
    await takeToken({
      key: `completion:${user.id}`,
      limit: COMPLETIONS_PER_MINUTE,
      windowSeconds: 60,
      message: "That's a lot of changes at once. Wait a minute and try again.",
    });
    await setCompletion(user.id, parsed.data.problemId, parsed.data.solved);
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    logger.error("setCompletion failed", errorContext(error));
    return { ok: false, message: "We couldn't save that. Try again." };
  }
  // One completion shows up on Home, every group page, and every roadmap containing the problem.
  revalidatePath("/", "layout");
  return { ok: true };
}
