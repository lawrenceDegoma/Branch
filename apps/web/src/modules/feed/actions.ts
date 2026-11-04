"use server";

import { revalidatePath } from "next/cache";
import { DomainError } from "@/lib/errors";
import { fieldErrorsFrom, formStateFromError, formValues, type FormState } from "@/lib/form";
import { errorContext, logger } from "@/lib/logger";
import { requireViewer } from "@/modules/auth/session";
import { createComment, deleteComment, editComment } from "./comments";
import { setReaction } from "./reactions";
import {
  commentIdSchema,
  createCommentSchema,
  createPostSchema,
  editCommentSchema,
  editPostSchema,
  postIdSchema,
  reactionInputSchema,
} from "./schemas";
import { createPost, deletePost, editPost, hidePost } from "./service";

function refreshFeeds() {
  revalidatePath("/home");
  revalidatePath("/groups", "layout");
  revalidatePath("/posts/[postId]", "page");
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

export type ReactionResult = { ok: true } | { ok: false; message: string };

/** Gives or takes back one reaction; the button flips optimistically and reverts on failure. */
export async function setReactionAction(
  postId: string,
  kind: string,
  on: boolean,
): Promise<ReactionResult> {
  const { user } = await requireViewer();
  const parsed = reactionInputSchema.safeParse({ postId, kind, on });
  if (!parsed.success) return { ok: false, message: "We couldn't find that post." };
  try {
    await setReaction(user.id, parsed.data.postId, parsed.data.kind, parsed.data.on);
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    logger.error("setReaction failed", errorContext(error));
    return { ok: false, message: "We couldn't save that. Try again." };
  }
  refreshFeeds();
  return { ok: true };
}

export async function createCommentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["postId", "parentId", "body", "spoiler"]);
  const parsed = createCommentSchema.safeParse(values);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  try {
    const comment = await createComment(user.id, parsed.data);
    refreshFeeds();
    // The new ID clears the form for the next comment.
    return { status: "success", message: "Comment posted.", data: { commentId: comment.id } };
  } catch (error) {
    return formStateFromError(error, values);
  }
}

export async function editCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["commentId", "body", "spoiler"]);
  const parsed = editCommentSchema.safeParse(values);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  try {
    const { commentId, ...input } = parsed.data;
    await editComment(user.id, commentId, input);
  } catch (error) {
    return formStateFromError(error, values);
  }
  refreshFeeds();
  return { status: "success", message: "Saved." };
}

export async function deleteCommentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const parsed = commentIdSchema.safeParse(formData.get("commentId"));
  if (!parsed.success) return { status: "error", message: "We couldn't find that comment." };
  try {
    await deleteComment(user.id, parsed.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refreshFeeds();
  return { status: "success", message: "Comment deleted." };
}
