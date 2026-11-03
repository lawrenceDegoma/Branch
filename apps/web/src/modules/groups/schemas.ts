import { z } from "zod";
import { timeZoneSchema } from "@/modules/profile/timezone";

export const groupIdSchema = z.uuid();

export const groupDetailsSchema = z.object({
  name: z.string().trim().min(1, "Give your group a name.").max(60, "Use at most 60 characters."),
  description: z
    .string()
    .trim()
    .max(280, "Use at most 280 characters.")
    .transform((value) => value || null),
  timezone: timeZoneSchema,
});
export type GroupDetailsInput = z.infer<typeof groupDetailsSchema>;

export const INVITE_EXPIRY_DAYS = [1, 7, 30] as const;
export const INVITE_MAX_USES = [1, 5, 10, 25] as const;

export const inviteOptionsSchema = z.object({
  expiresInDays: z.coerce
    .number()
    .refine(
      (days) => (INVITE_EXPIRY_DAYS as readonly number[]).includes(days),
      "Choose an expiry.",
    ),
  maxUses: z
    .string()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine(
      (uses) => uses === null || (INVITE_MAX_USES as readonly number[]).includes(uses),
      "Choose a limit.",
    ),
});
export type InviteOptionsInput = z.infer<typeof inviteOptionsSchema>;

export const memberUserIdSchema = z.string().trim().min(1).max(128);
