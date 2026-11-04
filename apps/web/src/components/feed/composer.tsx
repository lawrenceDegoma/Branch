"use client";

import { useActionState, useState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SearchSelect } from "@/components/forms/search-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { createPostAction } from "@/modules/feed/actions";
import { POST_BODY_MAX } from "@/modules/feed/schemas";
import type { ComposerGroup } from "@/modules/feed/service";

const NO_PROBLEM = { value: "", label: "No problem" };

/**
 * Writes a post to one group. On Home the group is chosen; on a group page it is fixed. The
 * optional problem list is that group's plan, so a post can point at "this week's" problem.
 */
export function Composer({
  groups,
  defaultGroupId,
}: {
  groups: ComposerGroup[];
  defaultGroupId?: string;
}) {
  const [state, action] = useActionState(createPostAction, initialFormState);
  const fixed = groups.length === 1;
  const [groupId, setGroupId] = useState(
    state.values?.groupId ?? defaultGroupId ?? groups[0]?.id ?? "",
  );
  const group = groups.find((g) => g.id === groupId);
  const problems = [
    NO_PROBLEM,
    ...(group?.problems ?? []).map((p) => ({ value: p.id, label: p.title })),
  ];
  // A successful post returns its ID; keying the fields on it clears them for the next post.
  const draftKey = state.status === "success" ? (state.data?.postId ?? "posted") : "draft";

  return (
    <form
      action={action}
      noValidate
      aria-label="New post"
      className="flex flex-col gap-4 rounded-xl bg-surface p-4 sm:p-5"
    >
      <FormAlert state={state} />
      {fixed ? (
        <input type="hidden" name="groupId" value={groupId} />
      ) : (
        <FormField name="groupId" label="Post to" error={state.fieldErrors?.groupId}>
          {(props) => (
            <NativeSelect
              {...props}
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      )}
      <div key={draftKey} className="flex flex-col gap-4">
        <FormField
          name="body"
          label={fixed ? `Post to ${group?.name ?? "this group"}` : "Message"}
          description={
            <>
              Ask for help, share a tip, or reflect on a problem. Markdown works, and{" "}
              <code>```python</code> starts highlighted code.
            </>
          }
          error={state.fieldErrors?.body}
        >
          {(props) => (
            <Textarea
              {...props}
              maxLength={POST_BODY_MAX}
              required
              defaultValue={state.status === "error" ? state.values?.body : undefined}
            />
          )}
        </FormField>
        {problems.length > 1 ? (
          <FormField
            name="problemId"
            label="About a problem (optional)"
            error={state.fieldErrors?.problemId}
          >
            {(props) => (
              <SearchSelect
                key={groupId}
                {...props}
                items={problems}
                defaultValue={state.status === "error" ? (state.values?.problemId ?? "") : ""}
                emptyText="No problem in this plan matches."
              />
            )}
          </FormField>
        ) : null}
        <CheckboxField
          id="field-spoiler"
          name="spoiler"
          label="Contains spoilers"
          description="Code blocks stay folded until each reader opens them."
          defaultChecked={state.status === "error" && state.values?.spoiler === "on"}
        />
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Posting…">Post</SubmitButton>
      </div>
    </form>
  );
}
