import { redirect } from "next/navigation";
import { SocialSignIn } from "@/components/forms/social-sign-in";
import { safeNextPath } from "@/lib/redirect";
import { enabledSocialProviders } from "@/modules/auth/auth";
import { getSession } from "@/modules/auth/session";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  if (await getSession()) redirect(next ?? "/home");

  return (
    <>
      <h1 className="text-2xl leading-8 font-semibold tracking-tight">Join Branch</h1>
      <p className="mt-1 mb-6 text-ink-muted">Grow together. Solve better.</p>
      <SocialSignIn providers={enabledSocialProviders} next={next} />
      <SignUpForm next={next} />
    </>
  );
}
