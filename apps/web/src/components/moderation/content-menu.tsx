"use client";

import { MoreHorizontal } from "lucide-react";
import { useActionState, useRef, useState } from "react";
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
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { initialFormState, type FormState } from "@/lib/form";
import { cn } from "@/lib/utils";
import { blockAction, reportAction } from "@/modules/moderation/actions";
import { REASON_LABEL, REPORT_NOTE_MAX, REPORT_REASONS } from "@/modules/moderation/schemas";

/**
 * "More actions" on someone else's post or comment: report it to the group's admin, or block its
 * author. Each opens a dialog; when it closes, focus returns to this menu's button.
 */
export function ContentMenu({
  target,
  authorId,
  authorName,
  canReport,
  canBlock,
}: {
  target: { postId: string } | { commentId: string };
  authorId: string;
  authorName: string;
  canReport: boolean;
  canBlock: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<"report" | "block" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const what = "postId" in target ? "post" : "comment";
  if (!canReport && !canBlock) return null;

  const close = (text?: string) => {
    setDialog(null);
    if (text) setMessage(text);
  };

  // A span, so it can sit inside a comment's author line (a paragraph).
  return (
    <span className="inline-flex items-center gap-2">
      <span role="status" className="text-xs text-ink-muted empty:hidden">
        {message}
      </span>
      <Menu>
        <MenuTrigger
          ref={trigger}
          aria-label={`More actions for ${authorName}'s ${what}`}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "-my-1")}
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </MenuTrigger>
        <MenuContent>
          {canReport ? (
            <MenuItem onClick={() => setDialog("report")}>Report {what}…</MenuItem>
          ) : null}
          {canBlock ? (
            <MenuItem onClick={() => setDialog("block")}>Block {authorName}…</MenuItem>
          ) : null}
        </MenuContent>
      </Menu>
      {dialog === "report" ? (
        <ReportDialog target={target} what={what} trigger={trigger} onClose={close} />
      ) : null}
      {dialog === "block" ? (
        <BlockDialog
          authorId={authorId}
          authorName={authorName}
          trigger={trigger}
          onClose={close}
        />
      ) : null}
    </span>
  );
}

type DialogProps = {
  trigger: React.RefObject<HTMLButtonElement | null>;
  onClose: (message?: string) => void;
};

function ReportDialog({
  target,
  what,
  trigger,
  onClose,
}: DialogProps & { target: { postId: string } | { commentId: string }; what: string }) {
  const [state, action] = useActionState(async (prev: FormState, data: FormData) => {
    const result = await reportAction(prev, data);
    if (result.status === "success") onClose(result.message);
    return result;
  }, initialFormState);
  const errors = state.fieldErrors ?? {};
  const id = `report-${"postId" in target ? target.postId : target.commentId}`;
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent finalFocus={trigger}>
        <AlertDialogTitle>Report this {what}?</AlertDialogTitle>
        <AlertDialogDescription>
          The group&apos;s admin sees it and can remove it. Nobody sees that it was you.
        </AlertDialogDescription>
        <form action={action} noValidate className="flex flex-col gap-4">
          {"postId" in target ? (
            <input type="hidden" name="postId" value={target.postId} />
          ) : (
            <input type="hidden" name="commentId" value={target.commentId} />
          )}
          <fieldset aria-describedby={errors.reason ? `${id}-reason-error` : undefined}>
            <legend className="mb-2 font-medium">Why?</legend>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((reason) => (
                <label key={reason} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    defaultChecked={state.values?.reason === reason}
                    className="size-4 accent-(--primary-fill)"
                  />
                  {REASON_LABEL[reason]}
                </label>
              ))}
            </div>
            {errors.reason ? (
              <p id={`${id}-reason-error`} className="mt-1 text-xs font-medium text-negative">
                {errors.reason}
              </p>
            ) : null}
          </fieldset>
          <FormField name={`${id}-note`} label="Anything to add? (optional)" error={errors.note}>
            {(props) => (
              <Textarea
                {...props}
                name="note"
                rows={2}
                maxLength={REPORT_NOTE_MAX}
                defaultValue={state.values?.note}
              />
            )}
          </FormField>
          {state.status === "error" && state.message ? <FormAlert state={state} /> : null}
          <AlertDialogFooter>
            <AlertDialogCancel />
            <SubmitButton pendingLabel="Reporting…">Report</SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BlockDialog({
  authorId,
  authorName,
  trigger,
  onClose,
}: DialogProps & { authorId: string; authorName: string }) {
  const [state, action] = useActionState(async (prev: FormState, data: FormData) => {
    const result = await blockAction(prev, data);
    if (result.status === "success") onClose(`You blocked ${authorName}.`);
    return result;
  }, initialFormState);
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent finalFocus={trigger}>
        <AlertDialogTitle>Block {authorName}?</AlertDialogTitle>
        <AlertDialogDescription>
          Their posts, comments, and reactions are hidden for you, and they can&apos;t comment on
          your posts or reply to you. They aren&apos;t told, and you both stay in your groups.
          Unblock any time in Settings.
        </AlertDialogDescription>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="userId" value={authorId} />
          {state.status === "error" && state.message ? <FormAlert state={state} /> : null}
          <AlertDialogFooter>
            <AlertDialogCancel />
            <SubmitButton variant="destructive" pendingLabel="Blocking…">
              Block
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
