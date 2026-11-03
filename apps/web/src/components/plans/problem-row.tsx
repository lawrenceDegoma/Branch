import { leetcodeProblemUrl } from "@branch/shared/catalog";
import { ExternalLink } from "lucide-react";
import { DifficultyPill } from "@/components/roadmaps/difficulty-pill";

export function ProblemRow({
  problem,
  sectionTitle,
  children,
}: {
  problem: { leetcodeSlug: string; title: string; difficulty: "EASY" | "MEDIUM" | "HARD" };
  sectionTitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <a
        href={leetcodeProblemUrl(problem.leetcodeSlug)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-w-0 items-center gap-1.5 font-medium underline-offset-4 hover:underline"
      >
        <span className="truncate">{problem.title}</span>
        <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
        <span className="sr-only">(opens LeetCode in a new tab)</span>
      </a>
      <DifficultyPill difficulty={problem.difficulty} />
      {sectionTitle ? <span className="text-xs text-ink-muted">{sectionTitle}</span> : null}
      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </li>
  );
}
