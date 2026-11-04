import { z } from "zod";
import { checkboxSchema } from "@/lib/form";

export const POST_BODY_MAX = 5000;
export const FEED_PAGE_SIZE = 20;

export const postIdSchema = z.uuid();

const body = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(POST_BODY_MAX, `Use at most ${POST_BODY_MAX} characters.`);

export const createPostSchema = z.object({
  groupId: z.uuid("Choose a group."),
  body,
  problemId: z
    .union([z.uuid("Choose a problem from the list."), z.literal("")])
    .optional()
    .transform((value) => value || null),
  spoiler: checkboxSchema,
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const editPostSchema = z.object({ postId: postIdSchema, body, spoiler: checkboxSchema });
export type EditPostInput = Omit<z.infer<typeof editPostSchema>, "postId">;

/** `?group=` filter and `?before=` cursor (a post ID; IDs are time-ordered UUIDv7). */
export const feedQuerySchema = z.object({
  group: z.uuid().optional().catch(undefined),
  before: z.uuid().optional().catch(undefined),
});

// ---------------------------------------------------------------------------------------------
// Reactions and comments
// ---------------------------------------------------------------------------------------------

/** The fixed set, in display order. Emoji are decoration; the label is the accessible name. */
export const REACTIONS = [
  { kind: "KUDOS", emoji: "👏", label: "Kudos" },
  { kind: "IMPRESSIVE", emoji: "🔥", label: "Impressive" },
  { kind: "HELPFUL", emoji: "💡", label: "Helpful" },
  { kind: "SAME_HERE", emoji: "🤝", label: "Same here" },
] as const;
export type ReactionKindValue = (typeof REACTIONS)[number]["kind"];

export const reactionInputSchema = z.object({
  postId: postIdSchema,
  kind: z.enum(REACTIONS.map((r) => r.kind) as [ReactionKindValue, ...ReactionKindValue[]]),
  on: z.boolean(),
});

export const COMMENT_BODY_MAX = 2000;
export const COMMENT_PAGE_SIZE = 50;

const commentBody = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(COMMENT_BODY_MAX, `Use at most ${COMMENT_BODY_MAX} characters.`);

export const commentIdSchema = z.uuid();

export const createCommentSchema = z.object({
  postId: postIdSchema,
  /** Replying to a reply files it under the same top-level comment. */
  parentId: z
    .union([commentIdSchema, z.literal("")])
    .optional()
    .transform((value) => value || null),
  body: commentBody,
  spoiler: checkboxSchema,
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const editCommentSchema = z.object({
  commentId: commentIdSchema,
  body: commentBody,
  spoiler: checkboxSchema,
});
export type EditCommentInput = Omit<z.infer<typeof editCommentSchema>, "commentId">;

/** `?after=` cursor on a post's page: the last top-level comment shown. */
export const commentQuerySchema = z.object({ after: z.uuid().optional().catch(undefined) });
