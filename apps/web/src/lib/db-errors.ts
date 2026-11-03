import "server-only";
import { Prisma } from "@branch/database";

/** True when a write failed on a unique constraint (optionally a specific column). */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  if (!field) return true;
  return JSON.stringify(error.meta ?? {}).includes(field);
}

/** True when a delete or update was blocked by a foreign key (for example, a row still in use). */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}
