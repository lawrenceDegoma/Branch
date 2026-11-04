import { z } from "zod";

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
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const editPostSchema = z.object({ postId: postIdSchema, body });

/** `?group=` filter and `?before=` cursor (a post ID; IDs are time-ordered UUIDv7). */
export const feedQuerySchema = z.object({
  group: z.uuid().optional().catch(undefined),
  before: z.uuid().optional().catch(undefined),
});
