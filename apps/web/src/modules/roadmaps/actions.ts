"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { fieldErrorsFrom, formStateFromError, formValues, type FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import { matchWaitingSubmissions } from "@/modules/integrations/submissions";
import {
  draftContentSchema,
  newProblemSchema,
  roadmapDetailsSchema,
  roadmapIdSchema,
} from "./schemas";
import {
  createCustomRoadmap,
  deleteRoadmap,
  discardDraft,
  findOrAddLeetCodeProblem,
  publishDraft,
  saveDraft,
  searchProblems,
  setLinkSharing,
  startDraft,
  updateRoadmapDetails,
  type LeetCodeLookup,
  type ProblemSummary,
} from "./service";

const notFoundState: FormState = { status: "error", message: "We couldn't find that roadmap." };

function roadmapIdFrom(value: unknown): string | null {
  const parsed = roadmapIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function refresh(roadmapId: string) {
  revalidatePath("/roadmaps");
  revalidatePath(`/roadmaps/${roadmapId}`, "layout");
}

export async function createRoadmapAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["title", "description"]);
  const parsed = roadmapDetailsSchema.safeParse(values);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const { id } = await createCustomRoadmap(user.id, parsed.data);
  revalidatePath("/roadmaps");
  redirect(`/roadmaps/${id}/edit`);
}

export async function updateRoadmapDetailsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const roadmapId = roadmapIdFrom(formData.get("roadmapId"));
  if (!roadmapId) return notFoundState;
  const values = formValues(formData, ["title", "description"]);
  const parsed = roadmapDetailsSchema.safeParse(values);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  try {
    await updateRoadmapDetails(user.id, roadmapId, parsed.data);
  } catch (error) {
    return formStateFromError(error, values);
  }
  refresh(roadmapId);
  return { status: "success", message: "Details saved." };
}

export async function startDraftAction(formData: FormData): Promise<void> {
  const { user } = await requireViewer();
  const roadmapId = roadmapIdFrom(formData.get("roadmapId"));
  if (!roadmapId) redirect("/roadmaps");
  await startDraft(user.id, roadmapId);
  redirect(`/roadmaps/${roadmapId}/edit`);
}

export type EditorResult = { ok: true; message: string } | { ok: false; message: string };

function editorError(error: unknown): EditorResult {
  if (error instanceof DomainError) return { ok: false, message: error.message };
  throw error;
}

/** Called by the editor with its whole draft; the content is re-validated here. */
export async function saveDraftAction(roadmapId: string, content: unknown): Promise<EditorResult> {
  const { user } = await requireViewer();
  const id = roadmapIdFrom(roadmapId);
  const parsed = draftContentSchema.safeParse(content);
  if (!id) return { ok: false, message: "We couldn't find that roadmap." };
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the draft and try again.",
    };
  try {
    await saveDraft(user.id, id, parsed.data);
  } catch (error) {
    return editorError(error);
  }
  refresh(id);
  return { ok: true, message: "Draft saved." };
}

export async function publishDraftAction(
  roadmapId: string,
  content: unknown,
): Promise<EditorResult> {
  const { user } = await requireViewer();
  const id = roadmapIdFrom(roadmapId);
  const parsed = draftContentSchema.safeParse(content);
  if (!id) return { ok: false, message: "We couldn't find that roadmap." };
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the draft and try again.",
    };
  try {
    await publishDraft(user.id, id, parsed.data);
  } catch (error) {
    return editorError(error);
  }
  refresh(id);
  redirect(`/roadmaps/${id}`);
}

export async function discardDraftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const roadmapId = roadmapIdFrom(formData.get("roadmapId"));
  if (!roadmapId) return notFoundState;
  try {
    await discardDraft(user.id, roadmapId);
  } catch (error) {
    return formStateFromError(error);
  }
  refresh(roadmapId);
  redirect(`/roadmaps/${roadmapId}`);
}

export async function deleteRoadmapAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const roadmapId = roadmapIdFrom(formData.get("roadmapId"));
  if (!roadmapId) return notFoundState;
  try {
    await deleteRoadmap(user.id, roadmapId);
  } catch (error) {
    return formStateFromError(error);
  }
  revalidatePath("/roadmaps");
  redirect("/roadmaps");
}

export async function setLinkSharingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const roadmapId = roadmapIdFrom(formData.get("roadmapId"));
  if (!roadmapId) return notFoundState;
  const enabled = formData.get("enabled") === "true";
  try {
    await setLinkSharing(user.id, roadmapId, enabled);
  } catch (error) {
    return formStateFromError(error);
  }
  refresh(roadmapId);
  return { status: "success", message: enabled ? "Share link created." : "Share link turned off." };
}

export async function searchProblemsAction(query: string): Promise<ProblemSummary[]> {
  await requireViewer();
  return searchProblems(String(query).slice(0, 200));
}

export type LookupResult = LeetCodeLookup | { status: "error"; message: string; field?: string };

export async function lookupLeetCodeAction(
  input: string,
  details?: unknown,
): Promise<LookupResult> {
  const { user } = await requireViewer();
  let parsedDetails;
  if (details !== undefined) {
    const parsed = newProblemSchema.safeParse(details);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        status: "error",
        message: issue?.message ?? "Check the details.",
        field: String(issue?.path[0] ?? ""),
      };
    }
    parsedDetails = parsed.data;
  }
  try {
    const result = await findOrAddLeetCodeProblem(
      user.id,
      String(input).slice(0, 500),
      parsedDetails,
    );
    // A newly added problem counts anyone's synced submissions that were waiting for it.
    if (parsedDetails && result.status === "found") {
      await matchWaitingSubmissions({ slug: result.problem.leetcodeSlug });
    }
    return result;
  } catch (error) {
    if (error instanceof DomainError)
      return { status: "error", message: error.message, field: error.field };
    throw error;
  }
}
