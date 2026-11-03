"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { changePasswordAction } from "@/modules/auth/actions";
import { PASSWORD_MIN } from "@/modules/auth/schemas";

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormField
        name="currentPassword"
        label="Current password"
        error={state.fieldErrors?.currentPassword}
      >
        {(props) => <Input {...props} type="password" autoComplete="current-password" required />}
      </FormField>
      <FormField
        name="newPassword"
        label="New password"
        description={`At least ${PASSWORD_MIN} characters. Other devices will be signed out.`}
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
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton variant="outline" pendingLabel="Updating…">
          Change password
        </SubmitButton>
      </div>
    </form>
  );
}
