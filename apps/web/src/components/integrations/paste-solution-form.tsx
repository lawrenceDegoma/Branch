"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SearchSelect } from "@/components/forms/search-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { pasteSolutionAction } from "@/modules/integrations/actions";

/** Paste a solution to a problem you've solved, so it can be analyzed. */
export function PasteSolutionForm({
  problems,
  languages,
  codeMax,
}: {
  problems: { id: string; title: string }[];
  languages: { slug: string; label: string }[];
  codeMax: number;
}) {
  // Counts saves, so the problem picker (which keeps its own state) starts empty after each one.
  const [saves, setSaves] = useState(0);
  const [state, action] = useActionState(async (prev: typeof initialFormState, data: FormData) => {
    const result = await pasteSolutionAction(prev, data);
    if (result.status === "success") setSaves((n) => n + 1);
    return result;
  }, initialFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormField
        name="problemId"
        label="Problem"
        description="One you've marked solved."
        error={errors.problemId}
      >
        {(props) => (
          <SearchSelect
            {...props}
            key={saves}
            items={problems.map((p) => ({ value: p.id, label: p.title }))}
            defaultValue={state.values?.problemId}
            emptyText="No solved problem matches."
          />
        )}
      </FormField>
      <FormField
        name="language"
        label="Language"
        description="Only Python solutions are analyzed for now; others are kept but not analyzed."
        error={errors.language}
      >
        {(props) => (
          <NativeSelect {...props} defaultValue={state.values?.language ?? "python3"}>
            {languages.map((language) => (
              <option key={language.slug} value={language.slug}>
                {language.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField name="code" label="Your solution" error={errors.code}>
        {(props) => (
          <Textarea
            {...props}
            defaultValue={state.values?.code}
            maxLength={codeMax}
            rows={10}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="font-mono text-[0.8125rem]"
          />
        )}
      </FormField>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton pendingLabel="Saving…">Save solution</SubmitButton>
      </div>
    </form>
  );
}
