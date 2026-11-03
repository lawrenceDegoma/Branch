import Link from "next/link";
import { redirect } from "next/navigation";
import { BranchWordmark } from "@/components/brand/branch-mark";
import { safeNextPath } from "@/lib/redirect";
import { requireUser } from "@/modules/auth/session";
import { getProfile } from "@/modules/profile/service";
import { listTimeZones } from "@/modules/profile/timezone";
import { suggestUsername } from "@/modules/profile/username";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await requireUser();
  const next = safeNextPath((await searchParams).next);
  if (await getProfile(user.id)) redirect(next ?? "/home");

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Link href="/" className="self-start rounded-md py-1">
        <BranchWordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 mb-6 text-ink-muted">Choose how friends will find you on Branch.</p>
        <OnboardingForm
          next={next}
          suggestedUsername={suggestUsername(user.name) || suggestUsername(user.email)}
          zones={listTimeZones()}
        />
      </main>
    </div>
  );
}
