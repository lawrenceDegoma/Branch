"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/form";
import { shareSolutionAction } from "@/modules/integrations/actions";

/**
 * Shares one solution to a group the viewer chooses, as a post: its estimate, an optional note,
 * and the code only if they tick it (folded as a spoiler). Nothing is shared any other way.
 */
export function ShareSolution({
  submissionId,
  title,
  groups,
  hasEstimate,
}: {
  submissionId: string;
  title: string;
  groups: { id: string; name: string }[];
  hasEstimate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState<{ group: string; href: string } | null>(null);
  const [state, action] = useActionState(async (prev: FormState, data: FormData) => {
    const result = await shareSolutionAction(prev, data);
    if (result.status === "success") {
      const group = groups.find((g) => g.id === data.get("groupId"))?.name ?? "the group";
      setShared({ group, href: result.data?.href ?? "/home" });
      setOpen(false);
    }
    return result;
  }, initialFormState);
  const errors = state.fieldErrors ?? {};
  const id = `share-${submissionId}`;

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
          Share<span className="sr-only"> {title} to a group</span>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Share {title}</AlertDialogTitle>
          <AlertDialogDescription>
            Posts {hasEstimate ? "its estimated complexity" : "your solution"} to a group you
            choose. Its members see it like any post of yours, and you can delete it later.
          </AlertDialogDescription>
          <form action={action} noValidate className="flex flex-col gap-4">
            <input type="hidden" name="submissionId" value={submissionId} />
            <FormField name={`${id}-group`} label="Group" error={errors.groupId}>
              {(props) => (
                <NativeSelect
                  {...props}
                  name="groupId"
                  defaultValue={state.values?.groupId ?? groups[0]?.id}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField name={`${id}-note`} label="Note (optional)" error={errors.note}>
              {(props) => (
                <Textarea
                  {...props}
                  name="note"
                  rows={3}
                  maxLength={1000}
                  defaultValue={state.values?.note}
                />
              )}
            </FormField>
            <div>
              <CheckboxField
                id={`${id}-code`}
                name="includeCode"
                label="Include my code"
                description="Folded as a spoiler, so friends who haven't solved it yet don't see it by accident."
                defaultChecked={state.values ? state.values.includeCode === "on" : !hasEstimate}
              />
              {errors.includeCode ? (
                <p className="mt-1 text-xs font-medium text-negative">{errors.includeCode}</p>
              ) : null}
            </div>
            {state.status === "error" && state.message ? <FormAlert state={state} /> : null}
            <AlertDialogFooter>
              <AlertDialogCancel />
              <SubmitButton pendingLabel="Sharing…">Share</SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      <span role="status" className="text-xs text-ink-muted empty:hidden">
        {shared ? (
          <>
            Shared to {shared.group}.{" "}
            <Link href={shared.href} className="text-ink underline underline-offset-4">
              View post
            </Link>
          </>
        ) : null}
      </span>
    </>
  );
}
