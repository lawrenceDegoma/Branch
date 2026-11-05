"use server";

import { revalidatePath } from "next/cache";
import { formStateFromError, type FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import { createConnection, revokeConnection } from "./connections";
import { connectionIdSchema, submissionIdSchema } from "./schemas";
import { deleteAllSubmissions, deleteSubmission } from "./submissions";

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/settings/submissions");
}

/** Creates a connection and returns its token, which is shown this once. */
export async function connectExtensionAction(_prev: FormState): Promise<FormState> {
  const { user } = await requireViewer();
  try {
    const { token } = await createConnection(user.id);
    refresh();
    return { status: "success", data: { token } };
  } catch (error) {
    return formStateFromError(error);
  }
}

export async function disconnectExtensionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const parsed = connectionIdSchema.safeParse(formData.get("connectionId"));
  if (!parsed.success) return { status: "error", message: "We couldn't find that connection." };
  try {
    await revokeConnection(user.id, parsed.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refresh();
  return { status: "success", message: "Disconnected." };
}

export async function deleteSubmissionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const parsed = submissionIdSchema.safeParse(formData.get("submissionId"));
  if (!parsed.success) return { status: "error", message: "We couldn't find that submission." };
  try {
    await deleteSubmission(user.id, parsed.data);
  } catch (error) {
    return formStateFromError(error);
  }
  refresh();
  return { status: "success", message: "Submission deleted." };
}

export async function deleteAllSubmissionsAction(_prev: FormState): Promise<FormState> {
  const { user } = await requireViewer();
  await deleteAllSubmissions(user.id);
  refresh();
  return { status: "success", message: "All synced submissions deleted." };
}
