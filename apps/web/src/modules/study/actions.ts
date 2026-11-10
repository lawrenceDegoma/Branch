"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsFrom, formStateFromError, formValues, type FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import { formatStudyTime } from "./duration";
import { studyDecisionSchema, studySharingSchema } from "./schemas";
import {
  decideSession,
  deleteSession,
  setStudySharing,
  startSession,
  stopSession,
} from "./service";

export async function startStudyAction(_prev: FormState): Promise<FormState> {
  const { user } = await requireViewer();
  await startSession(user.id);
  revalidatePath("/home");
  return { status: "success", message: "Studying." };
}

/**
 * Stops the timer. `data.ask` tells the timer to offer sharing for `data.sessionId`; a remembered
 * choice has already been applied otherwise.
 */
export async function stopStudyAction(_prev: FormState): Promise<FormState> {
  const { user } = await requireViewer();
  let result;
  try {
    result = await stopSession(user.id);
  } catch (error) {
    revalidatePath("/home");
    return formStateFromError(error);
  }
  revalidatePath("/", "layout");
  if (result.kind === "discarded") {
    return { status: "success", message: "Under a minute, so it wasn't saved." };
  }
  const time = formatStudyTime(result.durationMs);
  if (result.kind === "shared") {
    return { status: "success", message: `Saved ${time} and shared it to ${result.groupName}.` };
  }
  return {
    status: "success",
    message: result.autoStopped
      ? `The timer stopped counting at ${time}, and that's been saved.`
      : `Saved ${time}.`,
    data: result.ask ? { ask: "1", sessionId: result.sessionId, time } : undefined,
  };
}

/** Share a finished session to a group, or don't; optionally remember the choice. */
export async function decideStudyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["intent", "sessionId", "groupId", "note", "remember"]);
  if (!formData.get("remember")) delete values.remember;
  const parsed = studyDecisionSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  let post;
  try {
    post = await decideSession(user.id, parsed.data);
  } catch (error) {
    return formStateFromError(error, values);
  }
  revalidatePath("/", "layout");
  if (!post) {
    return {
      status: "success",
      message: values.remember ? "Not shared. Later sessions won't be either." : "Not shared.",
    };
  }
  return {
    status: "success",
    message: values.remember ? "Shared. Later sessions will be too." : "Shared.",
    data: { href: `/posts/${post.id}` },
  };
}

export async function deleteStudyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  try {
    await deleteSession(user.id, String(formData.get("sessionId") ?? ""));
  } catch (error) {
    return formStateFromError(error);
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Session deleted." };
}

/** Settings → Sharing: what happens after a study session. */
export async function updateStudySharingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["studySharing"]);
  const parsed = studySharingSchema.safeParse(values.studySharing);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: { studySharing: "Choose what happens after a session." },
      values,
    };
  }
  try {
    await setStudySharing(user.id, parsed.data);
  } catch (error) {
    return formStateFromError(error, values);
  }
  revalidatePath("/settings");
  return { status: "success", message: "Saved.", values };
}
