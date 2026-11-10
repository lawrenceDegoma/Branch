// Prints the unexpected server errors Branch recorded (the last 14 days), newest first, grouped
// by error code (the digest shown on the error page), so a code a person quotes can be found.
//
//   pnpm errors            the last 50 records
//   pnpm errors -- <code>  every record with that error code
//
// Uses DATABASE_URL; point it at production to read the live table.
import { createPrismaClient } from "../src/index";

const argv = process.argv.slice(2);
const code = (argv[0] === "--" ? argv[1] : argv[0])?.trim();

const prisma = createPrismaClient();
try {
  const rows = await prisma.serverError.findMany({
    where: code ? { digest: code } : {},
    orderBy: { at: "desc" },
    take: code ? 200 : 50,
  });
  if (rows.length === 0) {
    console.log(code ? `No records with error code ${code}.` : "No errors recorded.");
  }
  for (const row of rows) {
    console.log(
      `${row.at.toISOString()}  ${row.method} ${row.path}  [${row.routeType}]  code ${row.digest ?? "-"}  request ${row.requestId ?? "-"}`,
    );
    console.log(`  ${row.name}: ${row.message}`);
    if (code && row.stack)
      console.log(
        row.stack
          .split("\n")
          .slice(0, 8)
          .map((l) => `  ${l}`)
          .join("\n"),
      );
  }
} finally {
  await prisma.$disconnect();
}
