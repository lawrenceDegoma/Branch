import Link from "next/link";
import { formatDate, pluralize } from "@/lib/format";
import type { RoadmapView } from "@/modules/roadmaps/service";

export function RoadmapMeta({
  view,
  timeZone,
  basePath,
}: {
  view: RoadmapView;
  timeZone: string;
  basePath: string;
}) {
  const { roadmap, selectedVersion, versions } = view;
  const latest = versions[0]?.number;
  const problemCount =
    versions.find((v) => v.number === selectedVersion?.number)?.problemCount ?? 0;
  return (
    <div className="mb-6 flex flex-col gap-3">
      <p className="text-ink-muted">
        {roadmap.kind === "CURATED"
          ? "Curated list"
          : roadmap.ownerName
            ? `By ${roadmap.ownerName}`
            : "Custom roadmap"}
        {selectedVersion
          ? ` · Version ${selectedVersion.number}${selectedVersion.number === latest ? "" : " (older)"} · ${pluralize(problemCount, "problem")} · Published ${formatDate(selectedVersion.publishedAt, timeZone, true)}`
          : ""}
        {roadmap.sourceUrl ? (
          <>
            {" · "}
            <a
              href={roadmap.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-ink"
            >
              Source
            </a>
          </>
        ) : null}
      </p>
      {versions.length > 1 ? (
        <nav aria-label="Versions" className="flex flex-wrap gap-2">
          {versions.map((version) => (
            <Link
              key={version.number}
              href={version.number === latest ? basePath : `${basePath}?version=${version.number}`}
              aria-current={version.number === selectedVersion?.number ? "page" : undefined}
              className="rounded-full bg-raised px-3 py-1 text-xs text-ink-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              Version {version.number}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
