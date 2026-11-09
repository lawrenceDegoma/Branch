import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { AppearanceSync } from "@/components/theme/appearance-sync";
import { needsToMove } from "@/modules/auth/accounts";
import { requireViewer } from "@/modules/auth/session";
import { shownPhoto } from "@/modules/profile/photo";

// Every page under this layout requires a signed-in, onboarded user.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireViewer();
  const moving = await needsToMove(user.id);
  return (
    <AppShell
      viewer={{
        id: user.id,
        name: user.name,
        username: profile.username,
        photo: shownPhoto({ image: user.image ?? null, profile }),
      }}
      notice={
        moving ? (
          <p>
            Branch is moving to Google and GitHub sign-in.{" "}
            <Link href="/account/move" className="font-medium underline underline-offset-4">
              Connect one to keep your account
            </Link>
          </p>
        ) : null
      }
    >
      <AppearanceSync appearance={profile.appearance} />
      {children}
    </AppShell>
  );
}
