"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { resetPasswordAction } from "@/modules/auth/actions";
import { PASSWORD_MIN } from "@/modules/auth/schemas";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialFormState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      <FormField
        name="newPassword"
        label="New password"
        description={`At least ${PASSWORD_MIN} characters.`}
        error={state.fieldErrors?.newPassword}
      >
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            required
          />
        )}
      </FormField>
      <SubmitButton className="mt-2 w-full" pendingLabel="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
