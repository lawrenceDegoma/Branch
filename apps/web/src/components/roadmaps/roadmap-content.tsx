import { leetcodeProblemUrl } from "@branch/shared/catalog";
import { ExternalLink } from "lucide-react";
import type { VersionContent } from "@/modules/roadmaps/service";
import { DifficultyPill } from "./difficulty-pill";

/** A published version's sections and problems. Problem titles open on LeetCode. */
export function RoadmapContent({ sections }: { sections: VersionContent }) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`section-${section.id}`}
          className="rounded-xl bg-surface p-4 sm:p-5"
        >
          <h2 id={`section-${section.id}`} className="mb-3 text-base font-medium">
            {section.title}{" "}
            <span className="font-normal text-ink-muted tabular">{section.items.length}</span>
          </h2>
          <ol className="divide-y divide-rule">
            {section.items.map((item) => {
              // A tag that repeats the section's own title adds nothing.
              const tags = item.problem.tags.filter(
                (tag) => tag.name.toLowerCase() !== section.title.toLowerCase(),
              );
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <a
                    href={leetcodeProblemUrl(item.problem.leetcodeSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex min-w-0 items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                  >
                    <span className="truncate">{item.problem.title}</span>
                    <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                    <span className="sr-only">(opens LeetCode in a new tab)</span>
                  </a>
                  <DifficultyPill difficulty={item.problem.difficulty} />
                  {tags.length > 0 ? (
                    <span className="ml-auto text-xs text-ink-muted">
                      {tags.map((t) => t.name).join(", ")}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
