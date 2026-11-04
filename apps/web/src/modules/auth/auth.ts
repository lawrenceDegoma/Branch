import "server-only";
import { prisma } from "@branch/database";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { serverEnv } from "@/lib/env";

const env = serverEnv();

const socialProviders = {
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
    : {}),
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : {}),
};

/** Sign-in providers with credentials configured, in the order their buttons appear. */
export const enabledSocialProviders = (["google", "github"] as const).filter(
  (provider) => provider in socialProviders,
);

export const auth = betterAuth({
  appName: "Branch",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Reset links are issued by the owner (pnpm auth:reset-link); a reset signs out every device.
    revokeSessionsOnPasswordReset: true,
  },
  socialProviders,
  // Failures that happen before a sign-in knows where to return (e.g. an expired attempt) land on
  // the sign-in page, which explains the error code, rather than Better Auth's unstyled /error.
  onAPIError: { errorURL: new URL("/sign-in", env.BETTER_AUTH_URL).href },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // Enabled in production by Better Auth's default. Stored in Postgres so limits hold across
  // serverless instances.
  rateLimit: {
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
      "/reset-password": { window: 60, max: 5 },
    },
  },
  // Must be last: lets server actions set the session cookie.
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
