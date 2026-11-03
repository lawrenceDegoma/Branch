"use client";

import { useActionState } from "react";
import { CopyField } from "@/components/forms/copy-field";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { NativeSelect } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { createInviteAction } from "@/modules/groups/actions";
import { INVITE_EXPIRY_DAYS, INVITE_MAX_USES } from "@/modules/groups/schemas";

export function InviteCreator({ groupId }: { groupId: string }) {
  const [state, action] = useActionState(createInviteAction, initialFormState);
  const inviteUrl = state.status === "success" ? state.data?.inviteUrl : undefined;

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="groupId" value={groupId} />
        <FormField
          name="expiresInDays"
          label="Expires after"
          error={state.fieldErrors?.expiresInDays}
        >
          {(props) => (
            <NativeSelect {...props} defaultValue="7">
              {INVITE_EXPIRY_DAYS.map((days) => (
                <option key={days} value={days}>
                  {days === 1 ? "1 day" : `${days} days`}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField name="maxUses" label="Can be used" error={state.fieldErrors?.maxUses}>
          {(props) => (
            <NativeSelect {...props} defaultValue="">
              <option value="">Any number of times</option>
              {INVITE_MAX_USES.map((uses) => (
                <option key={uses} value={uses}>
                  {uses === 1 ? "Once" : `${uses} times`}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <SubmitButton pendingLabel="Creating…">Create link</SubmitButton>
      </form>
      {state.status === "error" && state.message ? <FormAlert state={state} /> : null}
      {inviteUrl ? (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-ink-muted">
            {state.message}
          </p>
          <CopyField value={inviteUrl} label="Invite link" />
        </div>
      ) : null}
    </div>
  );
}
