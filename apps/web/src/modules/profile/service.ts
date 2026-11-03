import "server-only";
import { prisma, type Profile } from "@branch/database";
import { isUniqueViolation } from "@/lib/db-errors";
import { DomainError } from "@/lib/errors";
import type { AppearanceValue, OnboardingInput, ProfileUpdateInput } from "./schemas";

// Every function here acts on the caller's own profile; `userId` must come from the session.

const usernameTaken = () =>
  new DomainError("USERNAME_TAKEN", "That username is taken. Try another.", "username");

export function getProfile(userId: string): Promise<Profile | null> {
  return prisma.profile.findUnique({ where: { userId } });
}

export async function createProfile(userId: string, input: OnboardingInput): Promise<Profile> {
  try {
    return await prisma.profile.create({
      data: { userId, username: input.username, timezone: input.timezone },
    });
  } catch (error) {
    if (isUniqueViolation(error, "username")) throw usernameTaken();
    if (isUniqueViolation(error)) {
      throw new DomainError("PROFILE_EXISTS", "Your profile is already set up.");
    }
    throw error;
  }
}

export async function updateProfile(userId: string, input: ProfileUpdateInput): Promise<Profile> {
  try {
    const [, profile] = await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { name: input.name } }),
      prisma.profile.update({
        where: { userId },
        data: { username: input.username, bio: input.bio, timezone: input.timezone },
      }),
    ]);
    return profile;
  } catch (error) {
    if (isUniqueViolation(error, "username")) throw usernameTaken();
    throw error;
  }
}

export async function setAppearance(userId: string, appearance: AppearanceValue): Promise<void> {
  await prisma.profile.update({ where: { userId }, data: { appearance } });
}
