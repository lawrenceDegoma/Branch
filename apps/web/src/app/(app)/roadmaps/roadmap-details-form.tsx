"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { createRoadmapAction, updateRoadmapDetailsAction } from "@/modules/roadmaps/actions";

export function RoadmapDetailsForm({
  roadmapId,
  defaults,
  submitLabel,
  pendingLabel,
}: {
  roadmapId?: string;
  defaults: { title: string; description: string };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, action] = useActionState(
    roadmapId ? updateRoadmapDetailsAction : createRoadmapAction,
    initialFormState,
  );
  const values = state.values ?? defaults;
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {roadmapId ? <input type="hidden" name="roadmapId" value={roadmapId} /> : null}
      <FormField name="title" label="Title" error={state.fieldErrors?.title}>
        {(props) => <Input {...props} required maxLength={80} defaultValue={values.title} />}
      </FormField>
      <FormField
        name="description"
        label="Description"
        description="Optional. Who it's for and how to use it."
        error={state.fieldErrors?.description}
      >
        {(props) => (
          <Textarea {...props} rows={3} maxLength={500} defaultValue={values.description} />
        )}
      </FormField>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        {roadmapId ? null : (
          <Link href="/roadmaps" className={buttonVariants({ variant: "ghost" })}>
            Cancel
          </Link>
        )}
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
