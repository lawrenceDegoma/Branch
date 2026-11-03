"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { deleteGroupAction } from "@/modules/groups/actions";

export function DeleteGroupForm({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [state, action] = useActionState(deleteGroupAction, initialFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />
      <p className="text-ink-muted">
        This permanently removes the group, its members list, plan, and invite links for everyone.
        Each member keeps their own solved problems.
      </p>
      <FormField
        name="confirmName"
        label={`Type "${groupName}" to confirm`}
        error={
          state.fieldErrors?.confirmName ?? (state.status === "error" ? state.message : undefined)
        }
      >
        {(props) => (
          <Input {...props} autoComplete="off" defaultValue={state.values?.confirmName} />
        )}
      </FormField>
      <div className="flex justify-end">
        <SubmitButton variant="destructive" pendingLabel="Deleting…">
          Delete group
        </SubmitButton>
      </div>
    </form>
  );
}
