"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { updateStartDateAction } from "@/modules/plans/actions";

export function StartDateForm({ groupId, startDate }: { groupId: string; startDate: string }) {
  const [state, action] = useActionState(updateStartDateAction, initialFormState);
  return (
    <form action={action} noValidate className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="groupId" value={groupId} />
      <FormField name="startDate" label="Start date" error={state.fieldErrors?.startDate}>
        {(props) => <Input {...props} type="date" defaultValue={startDate} className="w-44" />}
      </FormField>
      <SubmitButton variant="outline" pendingLabel="Saving…">
        Update
      </SubmitButton>
      <FormAlert state={state} />
    </form>
  );
}
