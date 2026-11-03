import { PageHeader } from "@/components/shell/page-header";
import { requireViewer } from "@/modules/auth/session";
import { RoadmapDetailsForm } from "../roadmap-details-form";

export const metadata = { title: "New roadmap" };

export default async function NewRoadmapPage() {
  await requireViewer();
  return (
    <div className="max-w-xl">
      <PageHeader
        title="New roadmap"
        description="Start with a title. You'll add sections and problems next."
      />
      <div className="rounded-xl bg-surface p-4 sm:p-5">
        <RoadmapDetailsForm
          defaults={{ title: "", description: "" }}
          submitLabel="Create and add problems"
          pendingLabel="Creating…"
        />
      </div>
    </div>
  );
}
