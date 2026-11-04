import { z } from "zod";
import { checkboxSchema } from "@/lib/form";
import { timeZoneSchema } from "./timezone";
import { usernameSchema } from "./username";

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(60, "Use at most 60 characters.");

export const onboardingSchema = z.object({
  username: usernameSchema,
  timezone: timeZoneSchema,
});

export const profileUpdateSchema = z.object({
  name: displayNameSchema,
  username: usernameSchema,
  bio: z
    .string()
    .trim()
    .max(280, "Use at most 280 characters.")
    .transform((value) => value || null),
  timezone: timeZoneSchema,
});

export const sharingSchema = z.object({ shareSolves: checkboxSchema });

export const appearanceSchema = z.enum(["SYSTEM", "LIGHT", "DARK"]);

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type AppearanceValue = z.infer<typeof appearanceSchema>;
