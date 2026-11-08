"use client";

import { useActionState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form";
import { updateAnalysisAction } from "@/modules/profile/actions";

export function AnalysisForm({ analyzeSolutions }: { analyzeSolutions: boolean }) {
  const [state, action] = useActionState(updateAnalysisAction, initialFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <CheckboxField
        id="field-analyzeSolutions"
        name="analyzeSolutions"
        label="Analyze my solutions"
        description="Estimate the time and space complexity of each solution you sync or paste, shown only to you in Review. Turning this off deletes your estimates."
        defaultChecked={state.values ? state.values.analyzeSolutions === "on" : analyzeSolutions}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save analysis
        </SubmitButton>
      </div>
    </form>
  );
}
