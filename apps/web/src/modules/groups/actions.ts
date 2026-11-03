"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/app-url";
import { fieldErrorsFrom, formStateFromError, formValues, type FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import {
  groupDetailsSchema,
  groupIdSchema,
  inviteOptionsSchema,
  memberUserIdSchema,
} from "./schemas";
import {
  acceptInvite,
  createGroup,
  createInvite,
  deleteGroup,
  leaveGroup,
  removeMember,
  revokeInvite,
  transferAdmin,
  updateGroup,
} from "./service";

const notFoundState: FormState = { status: "error", message: "We couldn't find that group." };

function groupIdFrom(formData: FormData): string | null {
  const parsed = groupIdSchema.safeParse(formData.get("groupId"));
  return parsed.success ? parsed.data : null;
}

function refreshGroup(groupId: string) {
  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`, "layout");
}

export async function createGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["name", "description", "timezone"]);
  const parsed = groupDetailsSchema.safeParse(values);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const group = await createGroup(user.id, parsed.data);
  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

export async function updateGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  if (!groupId) return notFoundState;
  const values = formValues(formData, ["name", "description", "timezone"]);
  const parsed = groupDetailsSchema.safeParse(values);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  try {
    await updateGroup(user.id, groupId, parsed.data);
  } catch (error) {
    return formStateFromError(error, values);
  }
  refreshGroup(groupId);
  return { status: "success", message: "Group details saved." };
}

export async function createInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  if (!groupId) return notFoundState;
  const parsed = inviteOptionsSchema.safeParse({
    expiresInDays: formData.get("expiresInDays"),
    maxUses: formData.get("maxUses") ?? "",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  try {
    const { token } = await createInvite(user.id, groupId, parsed.data);
    refreshGroup(groupId);
    return {
      status: "success",
      message: "Invite link created. Copy it now: for security it won't be shown again.",
      data: { inviteUrl: appUrl(`/invite/${token}`) },
    };
  } catch (error) {
    return formStateFromError(error);
  }
}

export async function revokeInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  const inviteId = groupIdSchema.safeParse(formData.get("inviteId"));
  if (!groupId || !inviteId.success) return notFoundState;
  try {
    await revokeInvite(user.id, groupId, inviteId.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refreshGroup(groupId);
  return { status: "success", message: "Invite turned off." };
}

export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  let groupId: string;
  try {
    ({ groupId } = await acceptInvite(user.id, String(formData.get("token") ?? "")));
  } catch (error) {
    return formStateFromError(error);
  }
  refreshGroup(groupId);
  redirect(`/groups/${groupId}`);
}

export async function leaveGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  if (!groupId) return notFoundState;
  try {
    await leaveGroup(user.id, groupId);
  } catch (error) {
    return formStateFromError(error);
  }
  revalidatePath("/groups");
  redirect("/groups");
}

export async function removeMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  const memberId = memberUserIdSchema.safeParse(formData.get("userId"));
  if (!groupId || !memberId.success) return notFoundState;
  try {
    await removeMember(user.id, groupId, memberId.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refreshGroup(groupId);
  return { status: "success", message: "Member removed." };
}

export async function transferAdminAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  const memberId = memberUserIdSchema.safeParse(formData.get("userId"));
  if (!groupId || !memberId.success) return notFoundState;
  try {
    await transferAdmin(user.id, groupId, memberId.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refreshGroup(groupId);
  // The settings page is admin-only; return to the group.
  redirect(`/groups/${groupId}`);
}

export async function deleteGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const groupId = groupIdFrom(formData);
  if (!groupId) return notFoundState;
  const values = formValues(formData, ["confirmName"]);
  try {
    await deleteGroup(user.id, groupId, values.confirmName ?? "");
  } catch (error) {
    return formStateFromError(error, values);
  }
  revalidatePath("/groups");
  redirect("/groups");
}
