"use client";

import { useActionState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form";
import { updateSharingAction } from "@/modules/profile/actions";

export function SharingForm({
  shareSolves,
  attachSolutions,
}: {
  shareSolves: boolean;
  attachSolutions: boolean;
}) {
  const [state, action] = useActionState(updateSharingAction, initialFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <CheckboxField
        id="field-shareSolves"
        name="shareSolves"
        label="Share my solves"
        description="When you mark a problem solved, post it to each group whose plan includes it, along with finished weeks and plans, and when the extension sees you solve one again (at most once a week per problem). Unmarking takes the posts down. You can hide any single post."
        defaultChecked={state.values ? state.values.shareSolves === "on" : shareSolves}
      />
      <CheckboxField
        id="field-attachSolutions"
        name="attachSolutions"
        label="Add my code to my solve posts"
        description="Needs Share my solves. When the extension syncs a solve, its post shows your code to the group, folded as a spoiler until someone opens it. Code longer than a post (5,000 characters) isn't added. Turning this off takes your code off every solve post at once; it never adds code to posts made before you turned it on."
        defaultChecked={state.values ? state.values.attachSolutions === "on" : attachSolutions}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save sharing
        </SubmitButton>
      </div>
    </form>
  );
}
