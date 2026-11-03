import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { requireViewer } from "@/modules/auth/session";
import { listRoadmapsForViewer } from "@/modules/roadmaps/service";

export const metadata = { title: "Roadmaps" };

type Row = {
  id: string;
  title: string;
  description: string | null;
  problemCount: number;
  latestVersion: number | null;
  note?: string;
};

function RoadmapRows({ rows }: { rows: Row[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/roadmaps/${row.id}`}
            className="flex items-center gap-4 rounded-xl bg-surface px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-raised"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium">{row.title}</p>
              <p className="mt-0.5 truncate text-ink-muted">
                {row.latestVersion ? pluralize(row.problemCount, "problem") : "Not published yet"}
                {row.note ? ` · ${row.note}` : ""}
                {row.description ? ` · ${row.description}` : ""}
              </p>
            </div>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function RoadmapsPage() {
  const { user } = await requireViewer();
  const { curated, mine, fromGroups } = await listRoadmapsForViewer(user.id);
  const newLink = (
    <Link href="/roadmaps/new" className={buttonVariants()}>
      New roadmap
    </Link>
  );

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <PageHeader title="Roadmaps" actions={newLink} className="mb-0" />
      <section aria-labelledby="yours-heading">
        <h2 id="yours-heading" className="mb-3 text-base font-medium">
          Your roadmaps
        </h2>
        {mine.length === 0 ? (
          <EmptyState
            title="You haven't made a roadmap yet"
            description="Build your own ordered list of problems, then use it in a group."
          />
        ) : (
          <RoadmapRows
            rows={mine.map((r) => ({ ...r, note: r.hasDraft ? "Unpublished changes" : undefined }))}
          />
        )}
      </section>
      {fromGroups.length > 0 ? (
        <section aria-labelledby="groups-heading">
          <h2 id="groups-heading" className="mb-3 text-base font-medium">
            Used by your groups
          </h2>
          <RoadmapRows
            rows={fromGroups.map((r) => ({
              ...r,
              note: r.ownerName ? `By ${r.ownerName}` : undefined,
            }))}
          />
        </section>
      ) : null}
      <section aria-labelledby="curated-heading">
        <h2 id="curated-heading" className="mb-3 text-base font-medium">
          Curated lists
        </h2>
        {curated.length === 0 ? (
          <p className="text-ink-muted">No curated lists are available yet.</p>
        ) : (
          <RoadmapRows rows={curated} />
        )}
      </section>
    </div>
  );
}
