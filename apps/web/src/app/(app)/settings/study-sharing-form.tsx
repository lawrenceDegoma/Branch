"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { NativeSelect } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { updateStudySharingAction } from "@/modules/study/actions";

/** What happens when a study session ends: the choice "Remember my decision" saves. */
export function StudySharingForm({
  value,
  groups,
}: {
  value: string;
  groups: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(updateStudySharingAction, initialFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4 border-t border-line pt-4">
      <FormField
        name="studySharing"
        label="After a study session"
        description="Sessions are private unless you share them. A session that stopped on its own after 4 hours always asks."
        error={state.fieldErrors?.studySharing}
      >
        {(props) => (
          <NativeSelect
            {...props}
            name="studySharing"
            defaultValue={state.values?.studySharing ?? value}
          >
            <option value="ASK">Ask each time</option>
            <option value="NEVER">Never share</option>
            {groups.map((g) => (
              <option key={g.id} value={`GROUP:${g.id}`}>
                Always share to {g.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save study sharing
        </SubmitButton>
      </div>
    </form>
  );
}
