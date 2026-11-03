import "server-only";
import { prisma } from "@branch/database";

/** True when the user can sign in with a password (as opposed to GitHub only). */
export async function hasPasswordAccount(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });
  return account !== null;
}
