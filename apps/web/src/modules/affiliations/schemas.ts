import { organizationKind } from "@branch/shared/organizations";
import { z } from "zod";
import { checkboxSchema } from "@/lib/form";

/** An organization ID of one kind, or empty for none. */
function organizationIdSchema(kind: "SCHOOL" | "COMPANY", message: string) {
  return z
    .string()
    .trim()
    .max(200)
    .refine((id) => id === "" || organizationKind(id) === kind, message)
    .transform((id) => id || null);
}

export const affiliationSchema = z.object({
  schoolId: organizationIdSchema("SCHOOL", "Choose a school from the list."),
  companyId: organizationIdSchema("COMPANY", "Choose a company from the list."),
  showAffiliation: checkboxSchema,
});

export const organizationSearchSchema = z.object({
  kind: z.enum(["SCHOOL", "COMPANY"]),
  query: z.string().trim().max(80),
});

export type AffiliationInput = z.infer<typeof affiliationSchema>;
