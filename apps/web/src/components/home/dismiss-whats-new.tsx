"use client";

import { useActionState, useRef } from "react";
import { focusWhenRemoved } from "@/components/forms/confirm-action";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState, type FormState } from "@/lib/form";
import { dismissWhatsNewAction } from "@/modules/changelog/actions";

/** Dismisses the card until the next update; focus then moves to `focusTarget`. */
export function DismissWhatsNew({ focusTarget }: { focusTarget: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [, action] = useActionState(async (prev: FormState) => {
    const result = await dismissWhatsNewAction(prev);
    if (result.status === "success") focusWhenRemoved(form.current, focusTarget);
    return result;
  }, initialFormState);
  return (
    <form ref={form} action={action}>
      <SubmitButton variant="ghost" size="sm" pendingLabel="Dismissing…">
        Dismiss<span className="sr-only"> what&apos;s new</span>
      </SubmitButton>
    </form>
  );
}
