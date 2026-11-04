import { ProblemRow } from "@/components/plans/problem-row";
import { CompletionToggle } from "@/components/progress/completion-toggle";
import type { VersionContent } from "@/modules/roadmaps/service";

/**
 * A published version's sections and problems. Problem titles open on LeetCode. With `solved`,
 * each problem gets the viewer's completion toggle and each section its solved count.
 */
export function RoadmapContent({
  sections,
  solved,
}: {
  sections: VersionContent;
  solved?: Set<string>;
}) {
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
            <span className="font-normal text-ink-muted tabular">
              {solved
                ? `${section.items.filter((item) => solved.has(item.problem.id)).length} of ${section.items.length} solved`
                : section.items.length}
            </span>
          </h2>
          <ol className="divide-y divide-rule">
            {section.items.map((item) => {
              // A tag that repeats the section's own title adds nothing.
              const tags = item.problem.tags.filter(
                (tag) => tag.name.toLowerCase() !== section.title.toLowerCase(),
              );
              return (
                <ProblemRow
                  key={item.id}
                  problem={item.problem}
                  leading={
                    solved ? (
                      <CompletionToggle
                        problemId={item.problem.id}
                        title={item.problem.title}
                        solved={solved.has(item.problem.id)}
                      />
                    ) : undefined
                  }
                >
                  {tags.length > 0 ? (
                    <span className="text-xs text-ink-muted">
                      {tags.map((t) => t.name).join(", ")}
                    </span>
                  ) : null}
                </ProblemRow>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
