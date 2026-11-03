"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TimezoneSelect } from "@/components/forms/timezone-select";
import { Input, Textarea } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/form";

export function GroupDetailsForm({
  action,
  groupId,
  defaults,
  zones,
  submitLabel,
  pendingLabel,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  groupId?: string;
  defaults: { name: string; description: string; timezone: string };
  zones: string[];
  submitLabel: string;
  pendingLabel: string;
  children?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values ?? defaults;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {groupId ? <input type="hidden" name="groupId" value={groupId} /> : null}
      <FormField name="name" label="Group name" error={state.fieldErrors?.name}>
        {(props) => <Input {...props} required maxLength={60} defaultValue={values.name} />}
      </FormField>
      <FormField
        name="description"
        label="Description"
        description="Optional. What the group is working toward."
        error={state.fieldErrors?.description}
      >
        {(props) => (
          <Textarea {...props} rows={2} maxLength={280} defaultValue={values.description} />
        )}
      </FormField>
      <FormField
        name="timezone"
        label="Group timezone"
        description="Weekly assignments start at midnight in this timezone."
        error={state.fieldErrors?.timezone}
      >
        {(props) => <TimezoneSelect {...props} zones={zones} value={values.timezone} />}
      </FormField>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        {children}
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
