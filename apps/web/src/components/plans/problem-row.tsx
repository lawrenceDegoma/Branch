import { leetcodeProblemUrl } from "@branch/shared/catalog";
import { ExternalLink } from "lucide-react";
import { DifficultyPill } from "@/components/roadmaps/difficulty-pill";

export function ProblemRow({
  problem,
  sectionTitle,
  leading,
  children,
}: {
  problem: {
    leetcodeSlug: string;
    title: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    premium?: boolean;
    freeAlternativeUrl?: string | null;
  };
  sectionTitle?: string;
  /** Shown before the title, such as the viewer's completion toggle. */
  leading?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      {leading}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
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
        {problem.premium ? (
          <span className="inline-flex h-5 flex-none items-center rounded-full bg-raised px-2 text-xs font-medium whitespace-nowrap text-ink-muted">
            Premium
          </span>
        ) : null}
        {problem.freeAlternativeUrl ? (
          <a
            href={problem.freeAlternativeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Free version
            <span className="sr-only"> of {problem.title} (opens in a new tab)</span>
          </a>
        ) : null}
        {sectionTitle ? <span className="text-xs text-ink-muted">{sectionTitle}</span> : null}
        {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
      </div>
    </li>
  );
}
