import { prisma } from "@branch/database";
import { serverEnv } from "@/lib/env";
import { errorContext, logger } from "@/lib/logger";

export async function GET() {
  try {
    serverEnv();
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("health check failed", errorContext(error));
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
