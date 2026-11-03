import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/user/avatar";
import { requireViewer } from "@/modules/auth/session";

export const metadata = { title: "Profile" };

const memberSince = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

export default async function ProfilePage() {
  const { user, profile } = await requireViewer();

  return (
    <div className="max-w-4xl">
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <Avatar userId={user.id} name={user.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl leading-8 font-semibold tracking-tight">{user.name}</h1>
          <p className="text-ink-muted">@{profile.username}</p>
        </div>
        <Link href="/settings#profile" className={buttonVariants({ variant: "outline" })}>
          Edit profile
        </Link>
      </header>
      {profile.bio ? (
        <p className="mb-8 max-w-prose text-base whitespace-pre-line">{profile.bio}</p>
      ) : null}
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-8 gap-y-2">
        <dt className="text-ink-muted">Member since</dt>
        <dd>{memberSince.format(user.createdAt)}</dd>
        <dt className="text-ink-muted">Timezone</dt>
        <dd>{profile.timezone.replaceAll("_", " ")}</dd>
      </dl>
    </div>
  );
}
