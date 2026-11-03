"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TimezoneSelect } from "@/components/forms/timezone-select";
import { Input, Textarea } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { updateProfileAction } from "@/modules/profile/actions";

export function ProfileForm({
  profile,
  zones,
}: {
  profile: { name: string; username: string; bio: string; timezone: string };
  zones: string[];
}) {
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  const values = state.values ?? profile;

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormField name="name" label="Name" error={state.fieldErrors?.name}>
        {(props) => <Input {...props} autoComplete="name" required defaultValue={values.name} />}
      </FormField>
      <FormField
        name="username"
        label="Username"
        description="3–30 characters: letters, numbers, - or _."
        error={state.fieldErrors?.username}
      >
        {(props) => (
          <Input
            {...props}
            autoCapitalize="none"
            spellCheck={false}
            required
            defaultValue={values.username}
          />
        )}
      </FormField>
      <FormField
        name="bio"
        label="Bio"
        description="Optional. Up to 280 characters, visible to people in your groups."
        error={state.fieldErrors?.bio}
      >
        {(props) => <Textarea {...props} maxLength={280} rows={3} defaultValue={values.bio} />}
      </FormField>
      <FormField name="timezone" label="Timezone" error={state.fieldErrors?.timezone}>
        {(props) => <TimezoneSelect {...props} zones={zones} value={values.timezone} />}
      </FormField>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}
