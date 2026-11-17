// Form results, shared by server actions and the forms that show them. Kept apart from form.ts,
// which builds Zod schemas: client components import this file, and Zod must stay off the client
// (src/test/client-bundle.test.ts).

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
