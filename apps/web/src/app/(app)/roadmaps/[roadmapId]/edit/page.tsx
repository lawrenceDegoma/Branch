import { redirect } from "next/navigation";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { RoadmapEditor } from "@/components/roadmaps/roadmap-editor";
import { PageHeader } from "@/components/shell/page-header";
import { orNotFound } from "@/lib/not-found";
import { requireViewer } from "@/modules/auth/session";
import { discardDraftAction } from "@/modules/roadmaps/actions";
import { getDraft } from "@/modules/roadmaps/service";

export const metadata = { title: "Edit roadmap" };

export default async function EditRoadmapPage({
  params,
}: {
  params: Promise<{ roadmapId: string }>;
}) {
  const { user } = await requireViewer();
  const { roadmapId } = await params;
  const { roadmap, draft, latestPublishedNumber } = await orNotFound(getDraft(user.id, roadmapId));
  if (!draft) redirect(`/roadmaps/${roadmapId}`);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={roadmap.title}
        description={
          latestPublishedNumber
            ? `Editing a draft of version ${draft.number}. Groups keep using version ${latestPublishedNumber} until they switch.`
            : "Editing your first draft. Publish it to use the roadmap in a group."
        }
      />
      <RoadmapEditor
        roadmapId={roadmap.id}
        initialSections={draft.sections}
        actions={
          latestPublishedNumber ? (
            <ConfirmAction
              action={discardDraftAction}
              fields={{ roadmapId: roadmap.id }}
              trigger="Discard draft"
              triggerVariant="ghost"
              title="Discard this draft?"
              description={`Your unpublished changes will be lost. Version ${latestPublishedNumber} stays as it is.`}
              confirmLabel="Discard draft"
              pendingLabel="Discarding…"
              destructive
            />
          ) : null
        }
      />
    </div>
  );
}
