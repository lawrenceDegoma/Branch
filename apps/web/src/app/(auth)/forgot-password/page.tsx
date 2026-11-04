import Link from "next/link";

export const metadata = { title: "Forgot password" };

// Branch sends no email; whoever runs this Branch issues reset links by hand.
export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl leading-8 font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-1 text-ink-muted">
        Branch doesn&apos;t send email yet. Ask the person who runs your Branch for a reset link. It
        works once and expires after an hour.
      </p>
      <p className="mt-6 text-ink-muted">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
