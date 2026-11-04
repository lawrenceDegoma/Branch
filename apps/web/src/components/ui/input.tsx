import { cn } from "@/lib/utils";

export const controlClassName =
  "block w-full rounded-[10px] border border-control bg-surface px-3 text-sm text-ink transition-colors duration-(--duration-fast) placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-raised disabled:text-ink-muted aria-invalid:border-negative dark:bg-ground";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input className={cn(controlClassName, "h-10 pointer-coarse:h-11", className)} {...props} />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea className={cn(controlClassName, "min-h-24 py-2 leading-5", className)} {...props} />
  );
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        controlClassName,
        // The browser's own arrow can't be positioned; draw a chevron inset like the text.
        "h-10 appearance-none bg-(image:--select-chevron) bg-size-[1rem] bg-position-[right_0.75rem_center] bg-no-repeat pr-10 pointer-coarse:h-11",
        className,
      )}
      {...props}
    />
  );
}
