"use client";

import { useActionState, useRef } from "react";
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

/**
 * After a successful removal the page re-renders without the item, taking the trigger (and the
 * dialog's focus return) with it. Once the trigger is gone, focus moves to `id` instead of
 * falling to the page body.
 */
export function focusWhenRemoved(trigger: HTMLElement | null, id: string) {
  let frames = 0;
  const check = () => {
    if (trigger && !trigger.isConnected) document.getElementById(id)?.focus();
    else if (frames++ < 120) requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

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
  focusAfterRemoval,
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
  /** For actions that remove the item holding this button: the ID of an element to focus. */
  focusAfterRemoval?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [state, formAction] = useActionState(async (prev: FormState, data: FormData) => {
    const result = await action(prev, data);
    if (result.status === "success" && focusAfterRemoval) {
      focusWhenRemoved(triggerRef.current, focusAfterRemoval);
    }
    return result;
  }, initialFormState);
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button ref={triggerRef} variant={triggerVariant} size="sm" />}>
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
