"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsFrom, formStateFromError, formValues, type FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import { createPostSchema, editPostSchema, postIdSchema } from "./schemas";
import { createPost, deletePost, editPost, hidePost } from "./service";

function refreshFeeds() {
  revalidatePath("/home");
  revalidatePath("/groups", "layout");
}

export async function createPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["groupId", "body", "problemId", "spoiler"]);
  const parsed = createPostSchema.safeParse(values);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  try {
    const post = await createPost(user.id, parsed.data);
    refreshFeeds();
    // The new ID clears the form; the chosen group is kept so the next post goes to the same place.
    return {
      status: "success",
      message: "Posted.",
      values: { groupId: parsed.data.groupId },
      data: { postId: post.id },
    };
  } catch (error) {
    return formStateFromError(error, values);
  }
}

export async function editPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["postId", "body", "spoiler"]);
  const parsed = editPostSchema.safeParse(values);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  try {
    const { postId, ...input } = parsed.data;
    await editPost(user.id, postId, input);
  } catch (error) {
    return formStateFromError(error, values);
  }
  refreshFeeds();
  return { status: "success", message: "Saved." };
}

export async function deletePostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const parsed = postIdSchema.safeParse(formData.get("postId"));
  if (!parsed.success) return { status: "error", message: "We couldn't find that post." };
  try {
    await deletePost(user.id, parsed.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refreshFeeds();
  return { status: "success", message: "Post deleted." };
}

export async function hidePostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const parsed = postIdSchema.safeParse(formData.get("postId"));
  if (!parsed.success) return { status: "error", message: "We couldn't find that post." };
  try {
    await hidePost(user.id, parsed.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refreshFeeds();
  return { status: "success", message: "Post hidden." };
}
