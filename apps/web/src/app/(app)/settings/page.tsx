import Link from "next/link";
import { ExtensionPanel } from "@/components/integrations/extension-panel";
import { Badges } from "@/components/settings/badges";
import { SettingsSection } from "@/components/settings/settings-section";
import { PageHeader } from "@/components/shell/page-header";
import { ThemeSelect } from "@/components/theme/theme-select";
import { Button } from "@/components/ui/button";
import { serverEnv } from "@/lib/env";
import { hasPasswordAccount, signInMethods } from "@/modules/auth/accounts";
import { enabledSocialProviders } from "@/modules/auth/auth";
import { signOutAction } from "@/modules/auth/actions";
import { requireViewer } from "@/modules/auth/session";
import { syncBadges } from "@/modules/badges/service";
import { listConnections } from "@/modules/integrations/connections";
import { listTimeZones } from "@/modules/profile/timezone";
import { shownPhoto } from "@/modules/profile/photo";
import { photoStorage } from "@/modules/profile/photo-storage";
import { studySharingView } from "@/modules/study/service";
import { PasswordForm } from "./password-form";
import { PhotoForm } from "./photo-form";
import { ProfileForm } from "./profile-form";
import { AnalysisForm } from "./analysis-form";
import { SharingForm } from "./sharing-form";
import { StudySharingForm } from "./study-sharing-form";

export const metadata = { title: "Settings" };

const PROVIDER_LABEL = { google: "Google", github: "GitHub" } as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const { user, profile } = await requireViewer();
  const passwordUpdated = (await searchParams).password === "updated";
  const canChangePassword = await hasPasswordAccount(user.id);
  const methods = await signInMethods(user.id);
  const providerPhotoLabel = shownPhoto({ image: user.image ?? null, profile: null })
    ? `Use my ${methods.providers.length === 1 ? PROVIDER_LABEL[methods.providers[0]!] : "Google or GitHub"} photo`
    : null;
  const [connections, badges, studySharing] = await Promise.all([
    listConnections(user.id),
    syncBadges([user.id]),
    studySharingView(user.id),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" />
      <SettingsSection
        id="profile"
        title="Profile"
        description="How you appear to people in your groups."
      >
        <div className="flex flex-col gap-5">
          <PhotoForm
            userId={user.id}
            name={user.name}
            photo={shownPhoto({ image: user.image ?? null, profile })}
            choice={profile.photo}
            providerPhotoLabel={providerPhotoLabel}
            uploadsEnabled={photoStorage() !== null}
          />
          <ProfileForm
            profile={{
              name: user.name,
              username: profile.username,
              bio: profile.bio ?? "",
              timezone: profile.timezone,
            }}
            zones={listTimeZones()}
          />
        </div>
      </SettingsSection>
      <SettingsSection
        id="badges"
        title="Badges"
        description="Milestones, kept once earned. Your groups see your top ones next to your name while you share your solves."
      >
        <Badges earned={badges.get(user.id) ?? []} timeZone={profile.timezone} />
      </SettingsSection>
      <SettingsSection
        id="sharing"
        title="Sharing"
        description="Solving a problem never posts anything unless you turn this on. Automatic posts include your code only if you add it below, and never its analysis. Study sessions are shared only as you choose."
      >
        <SharingForm shareSolves={profile.shareSolves} attachSolutions={profile.attachSolutions} />
        <StudySharingForm value={studySharing.value} groups={studySharing.groups} />
      </SettingsSection>
      <SettingsSection
        id="analysis"
        title="Code analysis"
        description="Branch reads your code without running it, on its own service; no AI provider or other company sees it. Estimates are private: a group sees one only if you share a solution yourself."
      >
        <AnalysisForm analyzeSolutions={profile.analyzeSolutions} />
      </SettingsSection>
      <SettingsSection
        id="extension"
        title="LeetCode extension"
        description="Counts what you solve on leetcode.com and neetcode.io automatically."
      >
        <ExtensionPanel
          connections={connections}
          storeUrl={serverEnv().EXTENSION_STORE_URL}
          now={new Date()}
          timeZone={profile.timezone}
        />
      </SettingsSection>
      <SettingsSection
        id="appearance"
        title="Appearance"
        description="System follows your device. Your choice is saved to your account."
      >
        <ThemeSelect />
      </SettingsSection>
      <SettingsSection id="account" title="Account" description={`Signed in as ${user.email}.`}>
        <div className="flex flex-col gap-6">
          {passwordUpdated ? (
            <p role="status" className="rounded-[10px] bg-positive-soft px-3 py-2.5 text-ink">
              Password updated. Other devices have been signed out.
            </p>
          ) : null}
          {enabledSocialProviders.length === 0 ? (
            canChangePassword ? (
              <PasswordForm />
            ) : null
          ) : methods.providers.length > 0 ? (
            <p className="text-ink-muted">
              You sign in with {methods.providers.map((p) => PROVIDER_LABEL[p]).join(" and ")}.
            </p>
          ) : (
            <p className="text-ink-muted">
              You sign in with a password, which Branch is phasing out.{" "}
              <Link href="/account/move" className="text-ink underline underline-offset-4">
                Move to Google or GitHub
              </Link>
            </p>
          )}
          <form action={signOutAction} className="flex justify-end border-t border-line pt-4">
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </SettingsSection>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-ink-muted">
        <Link href="/changelog" className="underline underline-offset-4 hover:text-ink">
          What&apos;s new
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">
          Privacy policy
        </Link>
      </p>
    </div>
  );
}
