"use client";

import { useActionState } from "react";
import { CopyField } from "@/components/forms/copy-field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form";
import { connectExtensionAction } from "@/modules/integrations/actions";

export const CONNECT_BUTTON_ID = "connect-extension";

/** Creates a connection and shows its token once, to paste into the extension. */
export function ConnectForm() {
  const [state, action] = useActionState(connectExtensionAction, initialFormState);
  const token = state.status === "success" ? state.data?.token : undefined;
  return (
    <form action={action} className="flex flex-col gap-3">
      {token ? (
        <div role="status" className="flex flex-col gap-2">
          <p>
            Paste this key into the Branch extension. It&apos;s shown only now; if you lose it,
            connect again.
          </p>
          <CopyField value={token} label="Extension key" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton id={CONNECT_BUTTON_ID} variant="outline" pendingLabel="Connecting…">
          Connect a browser
        </SubmitButton>
      </div>
    </form>
  );
}
