import { CircleAlert, CircleCheck } from "lucide-react";
import type { FormState } from "@/lib/form";
import { cn } from "@/lib/utils";

/** Form-level outcome. Errors are announced immediately; success politely. */
export function FormAlert({ state, className }: { state: FormState; className?: string }) {
  if (!state.message || state.status === "idle") return null;
  const isError = state.status === "error";
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-[10px] px-3 py-2.5",
        isError ? "bg-negative-soft text-ink" : "bg-positive-soft text-ink",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", isError ? "text-negative" : "text-positive")}
      />
      <p>{state.message}</p>
    </div>
  );
}
