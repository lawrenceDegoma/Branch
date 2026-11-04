"use client";

import { useActionState, useState } from "react";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { deletePostAction, editPostAction } from "@/modules/feed/actions";
import { POST_BODY_MAX } from "@/modules/feed/schemas";

/**
 * The post's body (rendered on the server and passed in as children) with the author's Edit and
 * the author's or admin's Delete. Editing swaps the body for a form in place.
 */
export function EditablePostBody({
  postId,
  body,
  canEdit,
  canDelete,
  children,
}: {
  postId: string;
  body: string;
  canEdit: boolean;
  canDelete: boolean;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(async (prev: typeof initialFormState, data: FormData) => {
    const result = await editPostAction(prev, data);
    if (result.status === "success") setEditing(false);
    return result;
  }, initialFormState);

  if (editing) {
    const textareaId = `edit-${postId}`;
    return (
      <form action={action} noValidate className="flex flex-col gap-3">
        <FormAlert state={state} />
        <input type="hidden" name="postId" value={postId} />
        <label htmlFor={textareaId} className="sr-only">
          Edit post
        </label>
        <Textarea
          id={textareaId}
          name="body"
          defaultValue={state.values?.body ?? body}
          maxLength={POST_BODY_MAX}
          autoFocus
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          aria-describedby={state.fieldErrors?.body ? `${textareaId}-error` : undefined}
        />
        {state.fieldErrors?.body ? (
          <p id={`${textareaId}-error`} className="text-xs font-medium text-negative">
            {state.fieldErrors.body}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
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
      {canEdit || canDelete ? (
        <div className="-mb-1 flex justify-end gap-1">
          {canEdit ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <ConfirmAction
              action={deletePostAction}
              fields={{ postId }}
              trigger="Delete"
              title="Delete this post?"
              description={
                canEdit
                  ? "It disappears from the group's feed. This can't be undone."
                  : "You're removing a member's post as the group admin. It disappears from the group's feed and the removal is recorded in the group's activity log."
              }
              confirmLabel="Delete post"
              pendingLabel="Deleting…"
              destructive
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
