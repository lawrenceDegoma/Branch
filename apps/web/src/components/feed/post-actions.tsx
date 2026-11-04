"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import {
  deleteCommentAction,
  deletePostAction,
  editCommentAction,
  editPostAction,
} from "@/modules/feed/actions";
import { COMMENT_BODY_MAX, POST_BODY_MAX } from "@/modules/feed/schemas";

const targets = {
  post: {
    field: "postId",
    max: POST_BODY_MAX,
    edit: editPostAction,
    remove: deletePostAction,
    editLabel: "Edit post",
    deleteTitle: "Delete this post?",
    /** Where focus goes once the deleted item is gone. */
    afterRemoval: "activity-heading",
    deleteConfirm: "Delete post",
    ownDelete: "It disappears from the group's feed, with its comments. This can't be undone.",
    adminDelete:
      "You're removing a member's post as the group admin. It disappears from the group's feed and the removal is recorded in the group's activity log.",
  },
  comment: {
    field: "commentId",
    max: COMMENT_BODY_MAX,
    edit: editCommentAction,
    remove: deleteCommentAction,
    editLabel: "Edit comment",
    deleteTitle: "Delete this comment?",
    afterRemoval: "comments-heading",
    deleteConfirm: "Delete comment",
    ownDelete: "Replies to it stay, under a deleted-comment note. This can't be undone.",
    adminDelete:
      "You're removing a member's comment as the group admin. The removal is recorded in the group's activity log.",
  },
} as const;

/**
 * A post's or comment's body (rendered on the server and passed in as children) with the
 * author's Edit and the author's or admin's Delete beside an optional footer. Editing swaps the
 * body for a form in place.
 */
export function EditableBody({
  target,
  id,
  body,
  spoiler,
  canEdit,
  canDelete,
  footer,
  returnTo,
  children,
}: {
  target: keyof typeof targets;
  id: string;
  body: string;
  spoiler: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Shown at the start of the actions row (reactions, a comments link). */
  footer?: React.ReactNode;
  /** After deleting, go here instead of staying (a post's own page would be a 404). */
  returnTo?: string;
  children: React.ReactNode;
}) {
  const t = targets[target];
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const returnFocus = useRef(false);
  const stopEditing = () => {
    returnFocus.current = true;
    setEditing(false);
  };
  const [state, action] = useActionState(async (prev: typeof initialFormState, data: FormData) => {
    const result = await t.edit(prev, data);
    if (result.status === "success") stopEditing();
    return result;
  }, initialFormState);

  // Opening the form: continue where the text ends. Leaving it removes the focused control, so
  // focus goes back to Edit.
  useEffect(() => {
    const end = field.current?.value.length;
    if (editing && end !== undefined) field.current?.setSelectionRange(end, end);
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  if (editing) {
    const textareaId = `edit-${id}`;
    return (
      <form action={action} noValidate className="flex flex-col gap-3">
        <FormAlert state={state} />
        <input type="hidden" name={t.field} value={id} />
        <label htmlFor={textareaId} className="sr-only">
          {t.editLabel}
        </label>
        <Textarea
          id={textareaId}
          name="body"
          defaultValue={state.values?.body ?? body}
          maxLength={t.max}
          autoFocus
          ref={field}
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          aria-describedby={state.fieldErrors?.body ? `${textareaId}-error` : undefined}
        />
        {state.fieldErrors?.body ? (
          <p id={`${textareaId}-error`} className="text-xs font-medium text-negative">
            {state.fieldErrors.body}
          </p>
        ) : null}
        <CheckboxField
          id={`${textareaId}-spoiler`}
          name="spoiler"
          label="Contains spoilers"
          description="Code blocks stay folded until each reader opens them."
          defaultChecked={state.values ? state.values.spoiler === "on" : spoiler}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={stopEditing}>
            Cancel
          </Button>
          <SubmitButton size="sm" pendingLabel="Saving…">
            Save
          </SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <>
      {children}
      {footer || canEdit || canDelete ? (
        <div className="-mb-1 flex flex-wrap items-center gap-1">
          {footer}
          <div className="ml-auto flex gap-1">
            {canEdit ? (
              <Button ref={editButton} variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <ConfirmAction
                action={t.remove}
                fields={{ [t.field]: id, ...(returnTo ? { returnTo } : {}) }}
                focusAfterRemoval={t.afterRemoval}
                trigger="Delete"
                title={t.deleteTitle}
                description={canEdit ? t.ownDelete : t.adminDelete}
                confirmLabel={t.deleteConfirm}
                pendingLabel="Deleting…"
                destructive
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
