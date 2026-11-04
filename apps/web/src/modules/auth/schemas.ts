import { z } from "zod";
import { displayNameSchema } from "@/modules/profile/schemas";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX),
});

export const signUpSchema = z.object({
  name: displayNameSchema,
  email,
  password: newPassword,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(PASSWORD_MAX),
    newPassword,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Choose a password different from your current one.",
    path: ["newPassword"],
  });

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  newPassword,
});

export const socialProviderSchema = z.enum(["google", "github"]);
export type SocialProvider = z.infer<typeof socialProviderSchema>;
