// Route-level loading UI only where the page cannot 404: a Suspense boundary starts streaming
// with a 200 status, so pages that call notFound() (groups, roadmaps) must not sit under one.
import { Skeleton } from "@/components/states/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-6 h-5 w-72 max-w-full" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
