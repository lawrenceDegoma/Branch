import { RoadmapContent } from "@/components/roadmaps/roadmap-content";
import { RoadmapMeta } from "@/components/roadmaps/roadmap-header";
import { PageHeader } from "@/components/shell/page-header";
import { orNotFound } from "@/lib/not-found";
import { requireViewer } from "@/modules/auth/session";
import { getSharedRoadmapView } from "@/modules/roadmaps/service";

export const metadata = { title: "Shared roadmap", robots: { index: false, follow: false } };

export default async function SharedRoadmapPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { user, profile } = await requireViewer();
  const { token } = await params;
  const view = await orNotFound(getSharedRoadmapView(user.id, token));
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={view.roadmap.title}
        description={view.roadmap.description ?? undefined}
        className="mb-2"
      />
      <RoadmapMeta
        view={{ ...view, versions: view.versions.slice(0, 1) }}
        timeZone={profile.timezone}
        basePath={`/roadmaps/shared/${token}`}
      />
      <RoadmapContent sections={view.sections} />
    </div>
  );
}
