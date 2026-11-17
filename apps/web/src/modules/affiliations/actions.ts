"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsFrom, formStateFromError, formValues, type FormState } from "@/lib/form";
import { requireViewer } from "@/modules/auth/session";
import type { OrganizationOption } from "./organizations";
import { affiliationSchema, organizationSearchSchema } from "./schemas";
import { searchOrganizations, setAffiliation } from "./service";

/** The search box's suggestions. Signed in only, like everything else in Branch. */
export async function searchOrganizationsAction(
  kind: string,
  query: string,
): Promise<OrganizationOption[]> {
  await requireViewer();
  const parsed = organizationSearchSchema.safeParse({ kind, query });
  if (!parsed.success) return [];
  return searchOrganizations(parsed.data.kind, parsed.data.query);
}

export async function updateAffiliationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["schoolId", "companyId", "showAffiliation"]);
  const parsed = affiliationSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  try {
    await setAffiliation(user.id, parsed.data);
  } catch (error) {
    return formStateFromError(error, values);
  }
  revalidatePath("/settings");
  revalidatePath("/rankings");
  revalidatePath("/groups", "layout");
  const { schoolId, companyId, showAffiliation } = parsed.data;
  return {
    status: "success",
    message:
      !schoolId && !companyId
        ? "Saved. You don't count toward any school or company."
        : showAffiliation
          ? "Saved. Your groups see your school and company."
          : "Saved. Only you see your school and company.",
    values,
  };
}
