"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { signInAction } from "@/modules/auth/actions";

export function SignInForm({ next }: { next: string | null }) {
  const [state, action] = useActionState(signInAction, initialFormState);
  const signUpHref = next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up";

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormAlert state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField name="email" label="Email" error={state.fieldErrors?.email}>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email}
          />
        )}
      </FormField>
      <FormField name="password" label="Password" error={state.fieldErrors?.password}>
        {(props) => <Input {...props} type="password" autoComplete="current-password" required />}
      </FormField>
      <Link
        href="/forgot-password"
        className="-mt-2 self-start text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Forgot password?
      </Link>
      <SubmitButton className="mt-2 w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-ink-muted">
        New to Branch?{" "}
        <Link href={signUpHref} className="font-medium text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
