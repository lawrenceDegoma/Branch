import "server-only";

// JSON responses for the extension's API. Never cached; errors carry a stable code the
// extension can act on and a message safe to show, never internals.

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(status: number, code: string, message: string) {
  return json({ error: { code, message } }, status);
}

export const unauthorized = () =>
  apiError(401, "UNAUTHORIZED", "This browser isn't connected to Branch. Connect it again.");
