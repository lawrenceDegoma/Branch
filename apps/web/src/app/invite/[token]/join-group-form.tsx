"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form";
import { acceptInviteAction } from "@/modules/groups/actions";

export function JoinGroupForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInviteAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <FormAlert state={state} />
      <SubmitButton size="lg" pendingLabel="Joining…">
        Join group
      </SubmitButton>
    </form>
  );
}
