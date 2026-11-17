// Limits and labels that forms show, kept out of schemas.ts so client components can import
// them without Zod (src/test/client-bundle.test.ts). schemas.ts re-exports them.

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
