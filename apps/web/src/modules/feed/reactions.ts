import "server-only";
import { prisma } from "@branch/database";
import { takeToken } from "@/lib/limits";
import type { ReactionKindValue } from "./schemas";
import { requireVisiblePost } from "./service";

/**
 * Gives or takes back one reaction. Idempotent: each person holds each kind at most once per post
 * (the primary key), so repeats and races change nothing; that also bounds reaction spam without
 * a rate limit. Returns the post's group so callers can refresh its pages.
 */
const REACTIONS_PER_MINUTE = 60;

export async function setReaction(
  viewerId: string,
  postId: string,
  kind: ReactionKindValue,
  on: boolean,
) {
  const { post } = await requireVisiblePost(viewerId, postId);
  await takeToken({
    key: `reaction:${viewerId}`,
    limit: REACTIONS_PER_MINUTE,
    windowSeconds: 60,
    message: "That's a lot of reactions at once. Wait a minute and try again.",
  });
  const key = { postId, userId: viewerId, kind };
  if (on) await prisma.reaction.createMany({ data: [key], skipDuplicates: true });
  else await prisma.reaction.deleteMany({ where: key });
  return { groupId: post.groupId };
}
