import { cn } from "@/lib/utils";

/**
 * Temporary Branch mark: a trunk with one path branching off it. Original development artwork,
 * not trademark-cleared; final logo is an open decision (PRD §10).
 */
export function BranchMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn("size-6", className)}>
      <path d="M7 3.5v17" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      <path
        d="M7 16.5c0-5 3.2-8 8.5-8"
        stroke="var(--brand)"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <circle cx="17.25" cy="8.5" r="2.75" fill="var(--brand)" />
    </svg>
  );
}

/** Lowercase "branch." wordmark with its accessible name kept as "Branch". */
export function BranchWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BranchMark />
      <span
        aria-hidden="true"
        className="text-[1.0625rem] leading-none font-semibold tracking-tight"
      >
        branch<span className="text-brand">.</span>
      </span>
      <span className="sr-only">Branch</span>
    </span>
  );
}
