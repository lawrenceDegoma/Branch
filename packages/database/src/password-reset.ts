// Owner-issued password reset links. Branch sends no email, so the person running the app creates
// a link with `pnpm auth:reset-link` and passes it on. The token is written in Better Auth's own
// format (`reset-password:<token>`, value = user ID), so Better Auth's resetPassword endpoint
// validates it, consumes it once, and sets the new password. An integration test pins that format
// against the installed Better Auth version.
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "./generated/prisma/client";

export const RESET_LINK_TTL_MINUTES = 60;

export async function createPasswordResetLink(
  prisma: PrismaClient,
  email: string,
  baseUrl: string,
  now = new Date(),
): Promise<{ url: string; expiresAt: Date } | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + RESET_LINK_TTL_MINUTES * 60_000);
  await prisma.verification.create({
    data: {
      id: randomBytes(16).toString("hex"),
      identifier: `reset-password:${token}`,
      value: user.id,
      expiresAt,
    },
  });
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  return { url: url.href, expiresAt };
}
