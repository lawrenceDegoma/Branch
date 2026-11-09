"use client";

import { useActionState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form";
import { updateSharingAction } from "@/modules/profile/actions";

export function SharingForm({ shareSolves }: { shareSolves: boolean }) {
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
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save sharing
        </SubmitButton>
      </div>
    </form>
  );
}
