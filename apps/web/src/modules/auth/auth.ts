import "server-only";
import { prisma } from "@branch/database";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { serverEnv } from "@/lib/env";
import { keepChosenIdentity } from "./link";

const env = serverEnv();

// Each sign-in refreshes the photo from the provider; the hook below keeps the name and email.
// Google also grants offline access (asked for at each sign-in, which Google requires to issue it)
// so the daily job can keep its photo current (modules/profile/google-photos.ts).
const socialProviders = {
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          overrideUserInfoOnSignIn: true,
        },
      }
    : {}),
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          overrideUserInfoOnSignIn: true,
          accessType: "offline" as const,
          prompt: "consent" as const,
        },
      }
    : {}),
};

/** Sign-in providers with credentials configured, in the order their buttons appear. */
export const enabledSocialProviders = (["google", "github"] as const).filter(
  (provider) => provider in socialProviders,
);

/**
 * New accounts sign up with Google or GitHub. A password sign-up remains only where it's switched
 * on (local development, tests) or where no provider is set up yet, so nobody is locked out.
 * Existing password accounts can still sign in, to move to a provider.
 */
export const passwordSignUpAllowed = env.PASSWORD_SIGN_UP || enabledSocialProviders.length === 0;

export const auth = betterAuth({
  appName: "Branch",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !passwordSignUpAllowed,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Reset links are issued by the owner (pnpm auth:reset-link); a reset signs out every device.
    revokeSessionsOnPasswordReset: true,
  },
  socialProviders,
  account: {
    // Moving to Google or GitHub links the provider to the account that's signed in, even when
    // its email differs from the one used with the password. (Signing in with a provider never
    // joins an unverified password account by email; Better Auth refuses that.)
    // Connecting one also brings its photo (the name and email stay; see the hook below).
    accountLinking: { enabled: true, allowDifferentEmails: true, updateUserInfoOnLink: true },
    // Provider tokens are stored encrypted with BETTER_AUTH_SECRET (ones stored before stay
    // readable).
    encryptOAuthTokens: true,
  },
  databaseHooks: {
    user: {
      update: {
        before: async (data, context) => ({ data: keepChosenIdentity(data, context?.path) }),
      },
    },
  },
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
