import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repository root.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // PRISMA_LOG_QUERIES=1 emits each query as an event (the query-budget tests count them).
    log: process.env.PRISMA_LOG_QUERIES ? [{ emit: "event", level: "query" }] : [],
  });
}

// Reuse one client across hot reloads in development so connections are not exhausted.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
