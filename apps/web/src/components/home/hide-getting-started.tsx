"use client";

import { useActionState, useRef } from "react";
import { focusWhenRemoved } from "@/components/forms/confirm-action";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState, type FormState } from "@/lib/form";
import { hideGettingStartedAction } from "@/modules/profile/actions";

/** Hides the checklist for good; focus moves to the feed's heading once it's gone. */
export function HideGettingStarted() {
  const form = useRef<HTMLFormElement>(null);
  const [, action] = useActionState(async (prev: FormState) => {
    const result = await hideGettingStartedAction(prev);
    if (result.status === "success") focusWhenRemoved(form.current, "activity-heading");
    return result;
  }, initialFormState);
  return (
    <form ref={form} action={action}>
      <SubmitButton variant="ghost" size="sm" pendingLabel="Hiding…">
        Hide<span className="sr-only"> the Get started checklist</span>
      </SubmitButton>
    </form>
  );
}
