"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TimezoneSelect } from "@/components/forms/timezone-select";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { completeOnboardingAction } from "@/modules/profile/actions";

export function OnboardingForm({
  next,
  suggestedUsername,
  zones,
}: {
  next: string | null;
  suggestedUsername: string;
  zones: string[];
}) {
  const [state, action] = useActionState(completeOnboardingAction, initialFormState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormAlert state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField
        name="username"
        label="Username"
        description="3–30 characters: letters, numbers, - or _. Friends see this in your groups."
        error={state.fieldErrors?.username}
      >
        {(props) => (
          <Input
            {...props}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            defaultValue={state.values?.username ?? suggestedUsername}
          />
        )}
      </FormField>
      <FormField
        name="timezone"
        label="Timezone"
        description="Used to show dates and deadlines in your local time."
        error={state.fieldErrors?.timezone}
      >
        {(props) => <TimezoneSelect {...props} zones={zones} value={state.values?.timezone} />}
      </FormField>
      <SubmitButton className="mt-2 w-full" pendingLabel="Saving…">
        Continue
      </SubmitButton>
    </form>
  );
}
