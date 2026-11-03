"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { signUpAction } from "@/modules/auth/actions";
import { PASSWORD_MIN } from "@/modules/auth/schemas";

export function SignUpForm({ next }: { next: string | null }) {
  const [state, action] = useActionState(signUpAction, initialFormState);
  const signInHref = next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormAlert state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField name="name" label="Name" error={state.fieldErrors?.name}>
        {(props) => (
          <Input {...props} autoComplete="name" required defaultValue={state.values?.name} />
        )}
      </FormField>
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
      <FormField
        name="password"
        label="Password"
        description={`At least ${PASSWORD_MIN} characters.`}
        error={state.fieldErrors?.password}
      >
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            required
          />
        )}
      </FormField>
      <SubmitButton className="mt-2 w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-ink-muted">
        Already have an account?{" "}
        <Link href={signInHref} className="font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
