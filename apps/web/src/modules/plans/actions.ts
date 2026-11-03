"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrorsFrom, formStateFromError, type FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import { groupIdSchema } from "@/modules/groups/schemas";
import { calendarDateSchema, createPlanSchema, weekNumberSchema } from "./schemas";
import {
  createPlan,
  endPlan,
  moveAssignment,
  updatePlanStartDate,
  upgradePlanVersion,
} from "./service";

const notFoundState: FormState = { status: "error", message: "We couldn't find that group." };

function groupIdFrom(formData: FormData): string | null {
  const parsed = groupIdSchema.safeParse(formData.get("groupId"));
  return parsed.success ? parsed.data : null;
}

function refresh(groupId: string) {
  revalidatePath(`/groups/${groupId}`, "layout");
  revalidatePath("/home");
}

export async function createPlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  if (!groupId) return notFoundState;
  const values = {
    roadmapVersionId: String(formData.get("roadmapVersionId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    pacingMode: String(formData.get("pacingMode") ?? ""),
    problemsPerWeek: String(formData.get("problemsPerWeek") ?? ""),
  };
  const parsed = createPlanSchema.safeParse({
    roadmapVersionId: values.roadmapVersionId,
    startDate: values.startDate,
    pacing:
      values.pacingMode === "PER_SECTION"
        ? { mode: "PER_SECTION" }
        : { mode: "PER_WEEK", problemsPerWeek: values.problemsPerWeek },
  });
  if (!parsed.success) {
    const errors = fieldErrorsFrom(parsed.error);
    // Nested pacing errors surface on the problems-per-week field.
    if (errors.pacing) errors.problemsPerWeek = errors.pacing;
    return { status: "error", fieldErrors: errors, values };
  }
  try {
    await createPlan(user.id, groupId, parsed.data);
  } catch (error) {
    return formStateFromError(error, values);
  }
  refresh(groupId);
  redirect(`/groups/${groupId}/plan`);
}

export async function moveAssignmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  const itemId = groupIdSchema.safeParse(formData.get("roadmapItemId"));
  const week = weekNumberSchema.safeParse(formData.get("weekNumber"));
  if (!groupId || !itemId.success) return notFoundState;
  if (!week.success) return { status: "error", message: "Choose a week between 1 and 104." };
  try {
    await moveAssignment(user.id, groupId, itemId.data, week.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refresh(groupId);
  return { status: "success", message: `Moved to week ${week.data}.` };
}

export async function updateStartDateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  if (!groupId) return notFoundState;
  const startDate = calendarDateSchema.safeParse(formData.get("startDate"));
  if (!startDate.success)
    return { status: "error", fieldErrors: { startDate: "Choose a valid date." } };
  try {
    await updatePlanStartDate(user.id, groupId, startDate.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refresh(groupId);
  return { status: "success", message: "Start date updated." };
}

export async function upgradePlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  if (!groupId) return notFoundState;
  try {
    await upgradePlanVersion(user.id, groupId);
  } catch (error) {
    return formStateFromError(error);
  }
  refresh(groupId);
  redirect(`/groups/${groupId}/plan`);
}

export async function endPlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  if (!groupId) return notFoundState;
  try {
    await endPlan(user.id, groupId);
  } catch (error) {
    return formStateFromError(error);
  }
  refresh(groupId);
  redirect(`/groups/${groupId}`);
}
