"use client";

import { useActionState } from "react";
import { CopyField } from "@/components/forms/copy-field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form";
import { setLinkSharingAction } from "@/modules/roadmaps/actions";

export function SharingForm({
  roadmapId,
  shareUrl,
}: {
  roadmapId: string;
  shareUrl: string | null;
}) {
  const [state, action] = useActionState(setLinkSharingAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="roadmapId" value={roadmapId} />
      <input type="hidden" name="enabled" value={shareUrl ? "false" : "true"} />
      {shareUrl ? (
        <CopyField value={shareUrl} label="Share link" />
      ) : (
        <p className="text-ink-muted">Link sharing is off.</p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton variant="outline" pendingLabel="Saving…">
          {shareUrl ? "Turn off link" : "Create share link"}
        </SubmitButton>
      </div>
    </form>
  );
}
