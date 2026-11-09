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

/** A person's photo, over their initials (which show if there's no photo or it fails to load). */
export function Avatar({
  userId,
  name,
  photo,
  size = "md",
  className,
}: {
  userId: string;
  name: string;
  /** From `shownPhoto()`: null shows initials. */
  photo?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ "--avatar-hue": hueFor(userId) } as React.CSSProperties}
      className={cn(
        "avatar relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none",
        sizes[size],
        className,
      )}
    >
      {initialsOf(name)}
      {photo ? (
        // A plain <img>: photos are already small squares, so they skip Next's image optimizer
        // (and its monthly allowance). No referrer goes to Google, GitHub, or Blob.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}
