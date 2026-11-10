"use server";

import { prisma } from "@branch/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form";
import { safeNextPath } from "@/lib/redirect";
import { getSession, requireUser, requireViewer } from "@/modules/auth/session";
import { setAnalyzeSolutions } from "@/modules/analysis/service";
import {
  analysisSchema,
  appearanceSchema,
  onboardingSchema,
  photoChoiceSchema,
  profileUpdateSchema,
  sharingSchema,
} from "./schemas";
import { MAX_PHOTO_BYTES } from "./photo";
import { photoStorage } from "./photo-storage";
import {
  choosePhoto,
  createProfile,
  getProfile,
  setAppearance,
  setSharing,
  updateProfile,
  uploadPhoto,
} from "./service";

function domainErrorState(error: DomainError, values?: Record<string, string>): FormState {
  return error.field
    ? { status: "error", fieldErrors: { [error.field]: error.message }, values }
    : { status: "error", message: error.message, values };
}

export async function completeOnboardingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData, ["username", "timezone"]);
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  try {
    await createProfile(user.id, parsed.data);
  } catch (error) {
    // A double submit lands here; the profile exists, so carry on.
    if (!(error instanceof DomainError && error.code === "PROFILE_EXISTS")) {
      if (error instanceof DomainError) return domainErrorState(error, values);
      throw error;
    }
  }
  redirect(safeNextPath(formData.get("next")) ?? "/home");
}

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["name", "username", "bio", "timezone"]);
  const parsed = profileUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  try {
    await updateProfile(user.id, parsed.data);
  } catch (error) {
    if (error instanceof DomainError) return domainErrorState(error, values);
    throw error;
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Profile saved." };
}

/** Saves the appearance choice to the account. A signed-out visitor keeps it on the device. */
export async function saveAppearanceAction(value: string): Promise<void> {
  const parsed = appearanceSchema.safeParse(value.toUpperCase());
  if (!parsed.success) return;
  const session = await getSession();
  if (!session || !(await getProfile(session.user.id))) return;
  await setAppearance(session.user.id, parsed.data);
  revalidatePath("/", "layout");
}

export async function updateSharingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["shareSolves", "attachSolutions"]);
  const saved = await setSharing(user.id, sharingSchema.parse(values));
  revalidatePath("/", "layout");
  return {
    status: "success",
    message: !saved.shareSolves
      ? "Your solves won't be shared, and neither will your code."
      : saved.attachSolutions
        ? "Your solves will be shared, with your code folded as a spoiler."
        : "Your solves will be shared, without your code.",
    values: {
      shareSolves: saved.shareSolves ? "on" : "",
      attachSolutions: saved.attachSolutions ? "on" : "",
    },
  };
}

export async function updateAnalysisAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireViewer();
  const values = formValues(formData, ["analyzeSolutions"]);
  const { analyzeSolutions } = analysisSchema.parse(values);
  await setAnalyzeSolutions(user.id, analyzeSolutions);
  revalidatePath("/settings");
  revalidatePath("/review");
  revalidatePath("/solutions");
  return {
    status: "success",
    message: analyzeSolutions
      ? "Your solutions will be analyzed."
      : "Analysis is off, and your estimates were deleted.",
    values,
  };
}

/** Hides Home's "Get started" checklist. */
export async function hideGettingStartedAction(_prev: FormState): Promise<FormState> {
  const { user } = await requireViewer();
  await prisma.profile.update({ where: { userId: user.id }, data: { gettingStartedHidden: true } });
  revalidatePath("/home");
  return { status: "success", message: "Hidden." };
}

export async function uploadPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const storage = photoStorage();
  if (!storage) return { status: "error", message: "Photo uploads aren't set up yet." };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", fieldErrors: { photo: "Choose a photo." } };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { status: "error", fieldErrors: { photo: "That photo is too large. Choose another." } };
  }
  try {
    await uploadPhoto(user.id, new Uint8Array(await file.arrayBuffer()), storage);
  } catch (error) {
    if (error instanceof DomainError) return domainErrorState(error);
    throw error;
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Photo saved." };
}

export async function choosePhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  const choice = photoChoiceSchema.safeParse(formData.get("photo"));
  if (!choice.success) return { status: "error", message: "Choose a photo option." };
  await choosePhoto(user.id, choice.data, photoStorage());
  revalidatePath("/", "layout");
  return {
    status: "success",
    message: choice.data === "NONE" ? "Your initials show instead of a photo." : "Photo updated.",
  };
}
