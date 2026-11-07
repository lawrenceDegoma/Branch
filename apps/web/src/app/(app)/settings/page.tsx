import { ExtensionPanel } from "@/components/integrations/extension-panel";
import { SettingsSection } from "@/components/settings/settings-section";
import { PageHeader } from "@/components/shell/page-header";
import { ThemeSelect } from "@/components/theme/theme-select";
import { Button } from "@/components/ui/button";
import { serverEnv } from "@/lib/env";
import { hasPasswordAccount } from "@/modules/auth/accounts";
import { signOutAction } from "@/modules/auth/actions";
import { requireViewer } from "@/modules/auth/session";
import { listConnections } from "@/modules/integrations/connections";
import { listTimeZones } from "@/modules/profile/timezone";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";
import { SharingForm } from "./sharing-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const { user, profile } = await requireViewer();
  const passwordUpdated = (await searchParams).password === "updated";
  const canChangePassword = await hasPasswordAccount(user.id);
  const connections = await listConnections(user.id);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" />
      <SettingsSection
        id="profile"
        title="Profile"
        description="How you appear to people in your groups."
      >
        <ProfileForm
          profile={{
            name: user.name,
            username: profile.username,
            bio: profile.bio ?? "",
            timezone: profile.timezone,
          }}
          zones={listTimeZones()}
        />
      </SettingsSection>
      <SettingsSection
        id="sharing"
        title="Sharing"
        description="Solving a problem never posts anything unless you turn this on."
      >
        <SharingForm shareSolves={profile.shareSolves} />
      </SettingsSection>
      <SettingsSection
        id="extension"
        title="LeetCode extension"
        description="Syncs accepted submissions you make on leetcode.com or neetcode.io while a browser is connected. Your code is private to you; groups only see a solve if sharing is on."
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
          {canChangePassword ? (
            <PasswordForm />
          ) : (
            <p className="text-ink-muted">
              You sign in with Google or GitHub, so there&apos;s no password to change.
            </p>
          )}
          <form action={signOutAction} className="flex justify-end border-t border-line pt-4">
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </SettingsSection>
    </div>
  );
}
