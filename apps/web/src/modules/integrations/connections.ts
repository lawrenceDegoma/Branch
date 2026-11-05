import "server-only";
import { prisma } from "@branch/database";
import { DomainError, NotFoundError } from "@/lib/errors";
import { connectionIdSchema } from "./schemas";
import { bearerToken, generateToken, hashToken } from "./tokens";

// A connection is one browser extension the person linked to their account. Its token is the
// only credential the extension holds; disconnecting (from Settings or from the extension)
// revokes it immediately.

const MAX_CONNECTIONS = 5;

export async function createConnection(userId: string) {
  const active = await prisma.extensionConnection.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_CONNECTIONS) {
    throw new DomainError(
      "TOO_MANY_CONNECTIONS",
      `You can connect up to ${MAX_CONNECTIONS} browsers. Disconnect one you no longer use first.`,
    );
  }
  const token = generateToken();
  const connection = await prisma.extensionConnection.create({
    data: { userId, tokenHash: hashToken(token) },
    select: { id: true },
  });
  return { id: connection.id, token };
}

export async function listConnections(userId: string) {
  return prisma.extensionConnection.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, lastUsedAt: true },
  });
}

export async function revokeConnection(userId: string, connectionId: string, now = new Date()) {
  if (!connectionIdSchema.safeParse(connectionId).success) throw connectionNotFound();
  const { count } = await prisma.extensionConnection.updateMany({
    where: { id: connectionId, userId, revokedAt: null },
    data: { revokedAt: now },
  });
  if (count === 0) throw connectionNotFound();
}

const connectionNotFound = () => new NotFoundError("We couldn't find that connection.");

/**
 * The connection behind a request's bearer token, or null when the header is missing, malformed,
 * unknown, or revoked. Records when the connection was last used.
 */
export async function authenticateExtension(authorization: string | null, now = new Date()) {
  const token = bearerToken(authorization);
  if (!token) return null;
  const connection = await prisma.extensionConnection.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!connection || connection.revokedAt) return null;
  await prisma.extensionConnection.update({
    where: { id: connection.id },
    data: { lastUsedAt: now },
  });
  return { connectionId: connection.id, userId: connection.userId };
}
