// Prints a one-time password reset link (valid for an hour) for an existing account.
//
//   pnpm auth:reset-link -- <email>
//
// Uses DATABASE_URL and BETTER_AUTH_URL; point them at production to reset a live account.
// Send the link to the person privately: anyone holding it can set the password.
import { createPasswordResetLink, RESET_LINK_TTL_MINUTES } from "../src/password-reset";
import { createPrismaClient } from "../src/index";

const argv = process.argv.slice(2);
const email = (argv[0] === "--" ? argv[1] : argv[0])?.trim();
const baseUrl = process.env.BETTER_AUTH_URL;
if (!email || !baseUrl) {
  console.error(
    "Usage: pnpm auth:reset-link -- <email>   (requires DATABASE_URL and BETTER_AUTH_URL)",
  );
  process.exit(1);
}

const prisma = createPrismaClient();
try {
  const link = await createPasswordResetLink(prisma, email, baseUrl);
  if (!link) {
    console.error(`No account uses ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(
      `Reset link for ${email} (expires in ${RESET_LINK_TTL_MINUTES} minutes, single use):`,
    );
    console.log(link.url);
  }
} finally {
  await prisma.$disconnect();
}
