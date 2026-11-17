// Limits and labels that forms show, kept out of schemas.ts so client components can import
// them without Zod (src/test/client-bundle.test.ts). schemas.ts re-exports them.

export const POST_BODY_MAX = 5000;
/** Posts a feed shows at first; "Show more posts" adds this many each time, up to FEED_SHOW_MAX. */
export const FEED_PAGE_SIZE = 10;
export const FEED_SHOW_MAX = 50;

/** The fixed set, in display order. Emoji are decoration; the label is the accessible name. */
export const REACTIONS = [
  { kind: "KUDOS", emoji: "👏", label: "Kudos" },
  { kind: "IMPRESSIVE", emoji: "🔥", label: "Impressive" },
  { kind: "HELPFUL", emoji: "💡", label: "Helpful" },
  { kind: "SAME_HERE", emoji: "🤝", label: "Same here" },
] as const;
export type ReactionKindValue = (typeof REACTIONS)[number]["kind"];

export const COMMENT_BODY_MAX = 2000;
export const COMMENT_PAGE_SIZE = 50;
