"use client";

import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";

// Never render the raw error message: it may contain internal details.
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader title="Something went wrong" />
      <ErrorState
        message="This page couldn't load. Your progress is saved; try again in a moment."
        action={
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </>
  );
}
