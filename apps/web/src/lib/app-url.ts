import "server-only";
import { serverEnv } from "./env";

/** Absolute URL on the app's public origin, for links people copy and share. */
export function appUrl(path: string): string {
  return new URL(path, serverEnv().BETTER_AUTH_URL).toString();
}
