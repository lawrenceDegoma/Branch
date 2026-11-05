import { prisma } from "@branch/database";
import { authenticateExtension, revokeConnection } from "@/modules/integrations/connections";
import { json, unauthorized } from "@/modules/integrations/http";

/** Who this browser is connected as, for the extension's popup. */
export async function GET(request: Request) {
  const auth = await authenticateExtension(request.headers.get("authorization"));
  if (!auth) return unauthorized();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: auth.userId },
    select: { name: true, profile: { select: { username: true } } },
  });
  return json({ name: user.name, username: user.profile?.username ?? null });
}

/** Disconnecting from the extension revokes its token. */
export async function DELETE(request: Request) {
  const auth = await authenticateExtension(request.headers.get("authorization"));
  if (!auth) return unauthorized();
  await revokeConnection(auth.userId, auth.connectionId);
  return json({ disconnected: true });
}
