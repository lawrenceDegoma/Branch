import Link from "next/link";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { SettingsSection } from "@/components/settings/settings-section";
import { PageHeader } from "@/components/shell/page-header";
import { appUrl } from "@/lib/app-url";
import { orNotFound } from "@/lib/not-found";
import { requireViewer } from "@/modules/auth/session";
import { deleteRoadmapAction } from "@/modules/roadmaps/actions";
import { getRoadmapView, requireOwnedRoadmap } from "@/modules/roadmaps/service";
import { RoadmapDetailsForm } from "../../roadmap-details-form";
import { SharingForm } from "./sharing-form";

export const metadata = { title: "Roadmap settings" };

export default async function RoadmapSettingsPage({
  params,
}: {
  params: Promise<{ roadmapId: string }>;
}) {
  const { user } = await requireViewer();
  const { roadmapId } = await params;
  await orNotFound(requireOwnedRoadmap(user.id, roadmapId));
  const { roadmap } = await getRoadmapView(user.id, roadmapId);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Roadmap settings"
        description={
          <Link
            href={`/roadmaps/${roadmap.id}`}
            className="underline-offset-4 hover:text-ink hover:underline"
          >
            {roadmap.title}
          </Link>
        }
      />
      <SettingsSection
        id="details"
        title="Details"
        description="Title and description apply to every version."
      >
        <RoadmapDetailsForm
          roadmapId={roadmap.id}
          defaults={{ title: roadmap.title, description: roadmap.description ?? "" }}
          submitLabel="Save details"
          pendingLabel="Saving…"
        />
      </SettingsSection>
      <SettingsSection
        id="sharing"
        title="Sharing"
        description="Private roadmaps are visible to you and to groups that use them. A link lets anyone signed in to Branch view it."
      >
        <SharingForm
          roadmapId={roadmap.id}
          shareUrl={roadmap.shareToken ? appUrl(`/roadmaps/shared/${roadmap.shareToken}`) : null}
        />
      </SettingsSection>
      <SettingsSection
        id="delete"
        title="Delete roadmap"
        description="Only possible while no group's plan uses it."
      >
        <div className="flex justify-end">
          <ConfirmAction
            action={deleteRoadmapAction}
            fields={{ roadmapId: roadmap.id }}
            trigger="Delete roadmap"
            triggerVariant="destructive"
            title={`Delete ${roadmap.title}?`}
            description="All versions and any draft are removed. This can't be undone."
            confirmLabel="Delete roadmap"
            pendingLabel="Deleting…"
            destructive
          />
        </div>
      </SettingsSection>
    </div>
  );
}
