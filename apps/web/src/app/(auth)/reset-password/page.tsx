import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <>
      <h1 className="text-2xl leading-8 font-semibold tracking-tight">Choose a new password</h1>
      {token ? (
        <>
          <p className="mt-1 mb-6 text-ink-muted">
            This signs you out on every device. Then sign in with the new password.
          </p>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <p className="mt-1 text-ink-muted">
          This link is incomplete. Copy the whole reset link, or{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-ink underline-offset-4 hover:underline"
          >
            ask for a new one
          </Link>
          .
        </p>
      )}
    </>
  );
}
