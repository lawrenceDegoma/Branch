import { Avatar } from "@/components/user/avatar";

const SHOWN = 3;

function names(people: { name: string; isViewer: boolean }[]): string {
  const labels = people.map((p) => (p.isViewer ? "you" : p.name));
  if (labels.length <= 2) return labels.join(" and ");
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

/** Overlapping avatars of the members who solved an assigned problem. */
export function SolvedBy({
  people,
}: {
  people: { userId: string; name: string; isViewer: boolean }[];
}) {
  if (people.length === 0) return null;
  const extra = people.length - SHOWN;
  return (
    <span className="inline-flex items-center">
      <span className="sr-only">Solved by {names(people)}</span>
      <span aria-hidden="true" className="flex -space-x-1.5">
        {people.slice(0, SHOWN).map((person) => (
          <Avatar
            key={person.userId}
            userId={person.userId}
            name={person.name}
            size="sm"
            className="ring-2 ring-surface"
          />
        ))}
      </span>
      {extra > 0 ? (
        <span aria-hidden="true" className="ml-1.5 text-xs text-ink-muted tabular">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
