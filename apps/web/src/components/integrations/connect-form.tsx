"use client";

import { PAGE_MESSAGE } from "@branch/shared/extension";
import { useActionState, useEffect, useState } from "react";
import { CopyField } from "@/components/forms/copy-field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form";
import { connectExtensionAction } from "@/modules/integrations/actions";

export const CONNECT_BUTTON_ID = "connect-extension";

/** How long to wait for the extension to answer before offering the key to paste. */
const HANDOFF_TIMEOUT_MS = 1500;

type Handoff = { token: string } & (
  { outcome: "connected"; name: string } | { outcome: "manual"; message?: string }
);

/**
 * Creates a connection. If the Branch extension is installed in this browser, its content script
 * takes the new key from this page directly; otherwise (or if it fails) the key is shown once to
 * paste into the extension.
 */
export function ConnectForm() {
  const [state, action] = useActionState(connectExtensionAction, initialFormState);
  const token = state.status === "success" ? state.data?.token : undefined;
  const [handoff, setHandoff] = useState<Handoff>();

  useEffect(() => {
    if (!token) return;
    const origin = window.location.origin;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== origin) return;
      if (event.data?.type !== PAGE_MESSAGE.connected) return;
      const result = event.data.result;
      setHandoff(
        result?.ok
          ? { token, outcome: "connected", name: String(result.name) }
          : { token, outcome: "manual", message: String(result?.message ?? "") },
      );
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ type: PAGE_MESSAGE.connect, token }, origin);
    const timer = setTimeout(
      () =>
        setHandoff((current) =>
          current?.token === token ? current : { token, outcome: "manual" },
        ),
      HANDOFF_TIMEOUT_MS,
    );
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [token]);

  const current = token && handoff?.token === token ? handoff : undefined;
  return (
    <form action={action} className="flex flex-col gap-3">
      {token ? (
        <div role="status" className="flex flex-col gap-2">
          {!current ? (
            <p className="text-ink-muted">Looking for the Branch extension in this browser…</p>
          ) : current.outcome === "connected" ? (
            <p>
              Connected. The extension in this browser now syncs to {current.name}&apos;s account.
            </p>
          ) : (
            <>
              {current.message ? <p className="text-negative">{current.message}</p> : null}
              <p>
                Paste this key into the Branch extension. It&apos;s shown only now; if you lose it,
                connect again.
              </p>
              <CopyField value={token} label="Extension key" />
            </>
          )}
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
