"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Submits its form, showing `pendingLabel` while the action runs. It is marked aria-disabled
 * and ignores clicks (and Enter, which submits through a click) while pending, but is never
 * natively disabled: a disabled button drops keyboard focus to the page body.
 */
export function SubmitButton({
  children,
  pendingLabel,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) event.preventDefault();
        else onClick?.(event);
      }}
      {...props}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
