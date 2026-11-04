import { Settings } from "lucide-react";
import Link from "next/link";
import { RoadmapContent } from "@/components/roadmaps/roadmap-content";
import { ProgressBar } from "@/components/progress/progress-bar";
import { RoadmapMeta } from "@/components/roadmaps/roadmap-header";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { orNotFound } from "@/lib/not-found";
import { requireViewer } from "@/modules/auth/session";
import { startDraftAction } from "@/modules/roadmaps/actions";
import { solvedAmong } from "@/modules/progress/service";
import { getRoadmapView } from "@/modules/roadmaps/service";

type Props = {
  params: Promise<{ roadmapId: string }>;
  searchParams: Promise<{ version?: string }>;
};

function versionFrom(value: string | undefined): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

export async function generateMetadata({ params }: Props) {
  const { user } = await requireViewer();
  const view = await orNotFound(getRoadmapView(user.id, (await params).roadmapId));
  return { title: view.roadmap.title };
}

export default async function RoadmapPage({ params, searchParams }: Props) {
  const { user, profile } = await requireViewer();
  const { roadmapId } = await params;
  const view = await orNotFound(
    getRoadmapView(user.id, roadmapId, versionFrom((await searchParams).version)),
  );
  const { roadmap } = view;
  const problemIds = view.sections.flatMap((s) => s.items.map((item) => item.problem.id));
  const solved = await solvedAmong(user.id, problemIds);
  const solvedCount = problemIds.filter((id) => solved.has(id)).length;

  const ownerActions = view.isOwner ? (
    <>
      {view.hasDraft ? (
        <Link href={`/roadmaps/${roadmap.id}/edit`} className={buttonVariants()}>
          Continue editing
        </Link>
      ) : (
        <form action={startDraftAction}>
          <input type="hidden" name="roadmapId" value={roadmap.id} />
          <Button type="submit">Edit</Button>
        </form>
      )}
      <Link
        href={`/roadmaps/${roadmap.id}/settings`}
        aria-label="Roadmap settings"
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <Settings aria-hidden="true" />
      </Link>
    </>
  ) : undefined;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={roadmap.title}
        description={roadmap.description ?? undefined}
        actions={ownerActions}
        className="mb-2"
      />
      <RoadmapMeta view={view} timeZone={profile.timezone} basePath={`/roadmaps/${roadmap.id}`} />
      {view.selectedVersion ? (
        <>
          {problemIds.length > 0 ? (
            <div className="mb-4 flex items-center gap-3">
              <ProgressBar value={solvedCount} total={problemIds.length} className="w-40" />
              <p className="text-ink-muted tabular">
                You&apos;ve solved <span className="text-ink">{solvedCount}</span> of{" "}
                {problemIds.length}
              </p>
            </div>
          ) : null}
          <RoadmapContent sections={view.sections} solved={solved} />
        </>
      ) : (
        <EmptyState
          title="Not published yet"
          description="Publish your draft to use this roadmap in a group."
          action={
            <Link
              href={`/roadmaps/${roadmap.id}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              Continue editing
            </Link>
          }
        />
      )}
    </div>
  );
}
