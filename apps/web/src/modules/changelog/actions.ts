"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import { dismissWhatsNew } from "./service";

/** Dismisses Home's "What's new" card until the next update. */
export async function dismissWhatsNewAction(_prev: FormState): Promise<FormState> {
  const { user } = await requireViewer();
  await dismissWhatsNew(user.id);
  revalidatePath("/home");
  return { status: "success", message: "Dismissed." };
}
