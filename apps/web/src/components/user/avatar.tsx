import { cn } from "@/lib/utils";

// A stable hue per person, so the same friend looks the same everywhere.
function hueFor(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts.at(-1)![0]] : [parts[0]?.[0]];
  return letters.filter(Boolean).join("").toUpperCase() || "?";
}

const sizes = { sm: "size-6 text-[0.625rem]", md: "size-8 text-xs", lg: "size-14 text-lg" };

export function Avatar({
  userId,
  name,
  size = "md",
  className,
}: {
  userId: string;
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ "--avatar-hue": hueFor(userId) } as React.CSSProperties}
      className={cn(
        "avatar inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        sizes[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
