import { DomainError } from "./errors";
import { z } from "zod";

/** Result returned by server actions that back forms. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values echoed back so a failed form keeps what the user typed. */
  values?: Record<string, string>;
  /** Extra result data for the form to display (for example, a newly created link). */
  data?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

/** A checkbox field: the form sends "on" when it is ticked and nothing otherwise. */
export const checkboxSchema = z
  .string()
  .optional()
  .transform((value) => value === "on");

export function formValues(formData: FormData, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]));
}

/** First error message per field, keyed by the field's name. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Maps an expected domain failure to form state; anything else is rethrown. */
export function formStateFromError(error: unknown, values?: Record<string, string>): FormState {
  if (error instanceof DomainError) {
    return error.field
      ? { status: "error", fieldErrors: { [error.field]: error.message }, values }
      : { status: "error", message: error.message, values };
  }
  throw error;
}
