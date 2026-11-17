// Limits and labels that forms show, kept out of schemas.ts so client components can import
// them without Zod (src/test/client-bundle.test.ts). schemas.ts re-exports them.

export const INVITE_EXPIRY_DAYS = [1, 7, 30] as const;
export const INVITE_MAX_USES = [1, 5, 10, 25] as const;
