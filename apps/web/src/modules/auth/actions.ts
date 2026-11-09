"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form";
import { errorContext, logger } from "@/lib/logger";
import { safeNextPath } from "@/lib/redirect";
import { auth } from "./auth";
import { authErrorMessage } from "./errors";
import {
  changePasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  socialProviderSchema,
} from "./schemas";
import { requireUser, requireViewer } from "./session";

function logUnexpected(action: string, error: unknown) {
  // Expected failures (bad password, duplicate email) are API errors with a 4xx status.
  const status = (error as { statusCode?: number }).statusCode;
  if (!status || status >= 500) logger.error(`${action} failed`, errorContext(error));
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    logUnexpected("sign-in", error);
    return { status: "error", message: authErrorMessage(error), values };
  }
  redirect(safeNextPath(formData.get("next")) ?? "/home");
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["name", "email"]);
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  try {
    await auth.api.signUpEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    logUnexpected("sign-up", error);
    return { status: "error", message: authErrorMessage(error), values };
  }
  const next = safeNextPath(formData.get("next"));
  redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
}

export async function signInWithProviderAction(formData: FormData): Promise<void> {
  const provider = socialProviderSchema.safeParse(formData.get("provider"));
  if (!provider.success) redirect("/sign-in?error=oauth");
  const next = safeNextPath(formData.get("next")) ?? "/home";
  const result = await auth.api.signInSocial({
    body: { provider: provider.data, callbackURL: next, errorCallbackURL: "/sign-in" },
    headers: await headers(),
  });
  if (!result.url) redirect("/sign-in?error=oauth");
  redirect(result.url);
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  try {
    await auth.api.changePassword({
      body: { ...parsed.data, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (error) {
    logUnexpected("change-password", error);
    return { status: "error", message: authErrorMessage(error) };
  }
  // Changing the password rotates the session cookie, which re-renders the page; confirm via the
  // URL rather than client state so the message survives that refresh.
  redirect("/settings?password=updated#account");
}

/** Public by design: the one-time token from an owner-issued link is the authorization. */
export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  try {
    await auth.api.resetPassword({ body: parsed.data, headers: await headers() });
  } catch (error) {
    logUnexpected("reset-password", error);
    return { status: "error", message: authErrorMessage(error) };
  }
  redirect("/sign-in/password?reset=done");
}

/** Starts connecting Google or GitHub to the signed-in account (moving off a password). */
export async function connectProviderAction(formData: FormData): Promise<void> {
  await requireViewer();
  const provider = socialProviderSchema.safeParse(formData.get("provider"));
  if (!provider.success) redirect("/account/move?error=unable_to_link_account");
  const result = await auth.api.linkSocialAccount({
    body: {
      provider: provider.data,
      callbackURL: "/account/move",
      errorCallbackURL: "/account/move",
    },
    headers: await headers(),
  });
  if (!result.url) redirect("/account/move?error=unable_to_link_account");
  redirect(result.url);
}
