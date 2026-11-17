import { z } from "zod";
import { checkboxSchema } from "@/lib/form";
import { COMMENT_BODY_MAX, POST_BODY_MAX, REACTIONS, type ReactionKindValue } from "./limits";

export {
  COMMENT_BODY_MAX,
  COMMENT_PAGE_SIZE,
  FEED_PAGE_SIZE,
  POST_BODY_MAX,
  REACTIONS,
  type ReactionKindValue,
} from "./limits";

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

export const reactionInputSchema = z.object({
  postId: postIdSchema,
  kind: z.enum(REACTIONS.map((r) => r.kind) as [ReactionKindValue, ...ReactionKindValue[]]),
  on: z.boolean(),
});

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
