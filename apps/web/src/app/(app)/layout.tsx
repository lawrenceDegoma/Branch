import { AppShell } from "@/components/shell/app-shell";
import { AppearanceSync } from "@/components/theme/appearance-sync";
import { requireViewer } from "@/modules/auth/session";

// Every page under this layout requires a signed-in, onboarded user.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireViewer();
  return (
    <AppShell viewer={{ id: user.id, name: user.name, username: profile.username }}>
      <AppearanceSync appearance={profile.appearance} />
      {children}
    </AppShell>
  );
}
