"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsFrom, formStateFromError, formValues, type FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import { blockUser, unblockUser } from "./blocks";
import { dismissReports, reportContent } from "./reports";
import { reportSchema } from "./schemas";

const optional = (values: Record<string, string>) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));

export async function reportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["postId", "commentId", "reason", "note"]);
  const parsed = reportSchema.safeParse(optional(values));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  try {
    const { created } = await reportContent(user.id, parsed.data);
    return {
      status: "success",
      message: created
        ? "Reported. The group's admin will see it; they won't see that it was you."
        : "You've already reported this.",
    };
  } catch (error) {
    return formStateFromError(error, values);
  }
}

/** The admin keeps a reported post or comment up. */
export async function dismissReportsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = String(formData.get("groupId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");
  try {
    await dismissReports(user.id, groupId, postId ? { postId } : { commentId });
  } catch (error) {
    return formStateFromError(error);
  }
  revalidatePath(`/groups/${groupId}`, "layout");
  return { status: "success", message: "Reports dismissed." };
}

export async function blockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  try {
    await blockUser(user.id, String(formData.get("userId") ?? ""));
  } catch (error) {
    return formStateFromError(error);
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Blocked." };
}

export async function unblockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  try {
    await unblockUser(user.id, String(formData.get("userId") ?? ""));
  } catch (error) {
    return formStateFromError(error);
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Unblocked." };
}
