"use client";

import { useActionState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Textarea } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { createCommentAction } from "@/modules/feed/actions";
import { COMMENT_BODY_MAX } from "@/modules/feed/schemas";

/** A new comment on a post, or (with `parentId`) a reply in that comment's thread. */
export function CommentForm({
  postId,
  parentId,
  label,
  submitLabel,
}: {
  postId: string;
  parentId?: string;
  label: string;
  submitLabel: string;
}) {
  const [state, action] = useActionState(createCommentAction, initialFormState);
  // A successful comment returns its ID; keying the fields on it clears them for the next one.
  const draftKey = state.status === "success" ? (state.data?.commentId ?? "sent") : "draft";
  const prefix = parentId ? `reply-${parentId}` : `comment-${postId}`;

  return (
    <form action={action} noValidate aria-label={label} className="flex flex-col gap-3">
      <FormAlert state={state} />
      <input type="hidden" name="postId" value={postId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <div key={draftKey} className="flex flex-col gap-3">
        <FormField name={`${prefix}-body`} label={label} error={state.fieldErrors?.body}>
          {(props) => (
            <Textarea
              {...props}
              name="body"
              maxLength={COMMENT_BODY_MAX}
              required
              className="min-h-20"
              defaultValue={state.status === "error" ? state.values?.body : undefined}
            />
          )}
        </FormField>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CheckboxField
            id={`${prefix}-spoiler`}
            name="spoiler"
            label="Contains spoilers"
            description="Code blocks stay folded until each reader opens them."
            defaultChecked={state.status === "error" && state.values?.spoiler === "on"}
          />
          <SubmitButton size="sm" pendingLabel="Posting…" className="ml-auto">
            {submitLabel}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
