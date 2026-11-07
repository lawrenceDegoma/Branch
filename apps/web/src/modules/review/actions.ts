"use server";

import { formatCalendarDate } from "@branch/shared/calendar";
import { revalidatePath } from "next/cache";
import { formStateFromError, type FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import { reviewInputSchema } from "./schemas";
import { describeGap } from "./schedule";
import { recordReview } from "./service";

/** Records how a due review went. */
export async function recordReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, profile } = await requireViewer();
  const parsed = reviewInputSchema.safeParse({
    problemId: formData.get("problemId"),
    outcome: formData.get("outcome"),
  });
  if (!parsed.success) return { status: "error", message: "We couldn't save that review." };
  try {
    const { title, dueOn, days } = await recordReview(
      user.id,
      parsed.data.problemId,
      parsed.data.outcome,
      profile.timezone,
    );
    revalidatePath("/review");
    revalidatePath("/home");
    return {
      status: "success",
      message: `${title} comes back ${describeGap(days)}, on ${formatCalendarDate(dueOn, { weekday: "short" })}.`,
    };
  } catch (error) {
    return formStateFromError(error);
  }
}
