import "server-only";

type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

// One JSON object per line, so hosted log drains can parse and filter entries.
function write(level: Level, message: string, context?: Context): void {
  const entry = JSON.stringify({ time: new Date().toISOString(), level, message, ...context });
  if (level === "error" || level === "warn") console.error(entry);
  else console.log(entry);
}

export const logger = {
  debug: (message: string, context?: Context) => write("debug", message, context),
  info: (message: string, context?: Context) => write("info", message, context),
  warn: (message: string, context?: Context) => write("warn", message, context),
  error: (message: string, context?: Context) => write("error", message, context),
};

export function errorContext(error: unknown): Context {
  return error instanceof Error ? { errorName: error.name, errorMessage: error.message } : {};
}
