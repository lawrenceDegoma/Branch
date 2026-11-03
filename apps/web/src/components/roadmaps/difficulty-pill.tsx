import { cn } from "@/lib/utils";

const styles = {
  EASY: "bg-positive-soft text-positive",
  MEDIUM: "bg-warning-soft text-warning-ink",
  HARD: "bg-negative-soft text-negative",
} as const;

const labels = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;

export function DifficultyPill({
  difficulty,
  className,
}: {
  difficulty: keyof typeof styles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 flex-none items-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        styles[difficulty],
        className,
      )}
    >
      {labels[difficulty]}
    </span>
  );
}
