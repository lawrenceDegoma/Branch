"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
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
import { initialFormState, type FormState } from "@/lib/form";

/** A button that asks for confirmation, then submits a server action from inside the dialog. */
export function ConfirmAction({
  action,
  fields,
  trigger,
  triggerVariant = "ghost",
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  trigger: string;
  triggerVariant?: "ghost" | "outline" | "destructive";
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  destructive?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant={triggerVariant} size="sm" />}>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <form action={formAction} className="flex flex-col gap-4">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {state.status === "error" ? <FormAlert state={state} /> : null}
          <AlertDialogFooter>
            <AlertDialogCancel />
            <SubmitButton
              variant={destructive ? "destructive" : "default"}
              pendingLabel={pendingLabel}
            >
              {confirmLabel}
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
