import "server-only";
import { z } from "zod";

const optionalSecret = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
    GITHUB_CLIENT_ID: optionalSecret,
    GITHUB_CLIENT_SECRET: optionalSecret,
    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,
    /** The extension's Chrome Web Store page; Settings links to it once it's set. */
    EXTENSION_STORE_URL: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .pipe(z.url({ protocol: /^https$/, hostname: /^chromewebstore\.google\.com$/ }).optional())
      .optional(),
    /** Shown on /privacy for questions and deletion requests. */
    PRIVACY_CONTACT_EMAIL: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .pipe(z.email().optional())
      .optional(),
    /** Vercel sends it to the daily job; without it the job refuses every request. */
    CRON_SECRET: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .pipe(z.string().min(16, "must be at least 16 characters").optional())
      .optional(),
  })
  .refine((env) => !env.GITHUB_CLIENT_ID === !env.GITHUB_CLIENT_SECRET, {
    message: "set both or neither",
    path: ["GITHUB_CLIENT_ID"],
  })
  .refine((env) => !env.GOOGLE_CLIENT_ID === !env.GOOGLE_CLIENT_SECRET, {
    message: "set both or neither",
    path: ["GOOGLE_CLIENT_ID"],
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates server configuration. Errors name the offending variables but never echo
 * their values, so secrets cannot leak into logs.
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid server environment variables: ${names.join(", ")}. See .env.example.`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
