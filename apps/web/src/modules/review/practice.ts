import "server-only";
import { prisma } from "@branch/database";
import { practiceReason, topicStandings, type TopicRef } from "./topics";

// Targeted practice: for the topics the user's reviews say need work, a few problems they haven't
// solved yet, easiest first. Derived on every read from completions and reviews, never stored, and
// private to the user like the rest of review.

/** Reviews read per request; per topic only the latest few count, so older ones rarely matter. */
const ATTEMPTS_READ = 500;
const TOPICS_SUGGESTED = 3;
const PROBLEMS_PER_TOPIC = 2;
/**
 * A suggestion the user solves stays in place (checked) for a day, so it doesn't vanish under
 * their cursor. Only problems solved after the topic's latest struggle qualify: anything solved
 * before then was never a suggestion.
 */
const KEEP_SOLVED_MS = 24 * 60 * 60 * 1000;

const tagRef = { select: { tag: { select: { slug: true, name: true } } } } as const;
const topicsOf = (tags: { tag: TopicRef }[]) => tags.map((t) => t.tag);

export async function getPractice(userId: string, now = new Date()) {
  const [attempts, completions, tags] = await Promise.all([
    prisma.reviewAttempt.findMany({
      where: { userId },
      orderBy: { id: "desc" },
      take: ATTEMPTS_READ,
      select: { outcome: true, reviewedAt: true, problem: { select: { tags: tagRef } } },
    }),
    prisma.problemCompletion.findMany({
      where: { userId },
      select: { problem: { select: { tags: tagRef } } },
    }),
    prisma.tag.findMany({
      select: { slug: true, name: true, _count: { select: { problems: true } } },
    }),
  ]);

  const solvedByTopic = new Map<string, number>();
  for (const { problem } of completions) {
    for (const { slug } of topicsOf(problem.tags)) {
      solvedByTopic.set(slug, (solvedByTopic.get(slug) ?? 0) + 1);
    }
  }
  const standings = topicStandings({
    attempts: attempts.map((a) => ({ outcome: a.outcome, topics: topicsOf(a.problem.tags) })),
    solvedByTopic,
    totalByTopic: new Map(
      tags.map(({ slug, name, _count }) => [
        slug,
        { topic: { slug, name }, total: _count.problems },
      ]),
    ),
  });

  // Attempts are newest first, so the first struggle seen per topic is its latest.
  const lastStruggle = new Map<string, Date>();
  for (const attempt of attempts) {
    if (attempt.outcome !== "AGAIN" && attempt.outcome !== "HARD") continue;
    for (const { slug } of topicsOf(attempt.problem.tags)) {
      if (!lastStruggle.has(slug)) lastStruggle.set(slug, attempt.reviewedAt);
    }
  }

  const weak = standings.filter((s) => s.status === "needs-practice").slice(0, TOPICS_SUGGESTED);
  const dayAgo = now.getTime() - KEEP_SOLVED_MS;
  const practice = await Promise.all(
    weak.map(async (standing) => {
      const struggledAt = lastStruggle.get(standing.topic.slug)?.getTime() ?? now.getTime();
      const keepSince = new Date(Math.max(dayAgo, struggledAt));
      const problems = await prisma.problem.findMany({
        where: {
          tags: { some: { tag: { slug: standing.topic.slug } } },
          premium: false,
          OR: [
            { completions: { none: { userId } } },
            { completions: { some: { userId, completedAt: { gte: keepSince } } } },
          ],
        },
        // Within a difficulty, the order the catalog was loaded in (IDs are time-ordered).
        orderBy: [{ difficulty: "asc" }, { id: "asc" }],
        take: PROBLEMS_PER_TOPIC,
        select: {
          id: true,
          title: true,
          leetcodeSlug: true,
          difficulty: true,
          completions: { where: { userId }, select: { problemId: true } },
        },
      });
      return {
        topic: standing.topic,
        reason: practiceReason(standing),
        problems: problems.map(({ completions: done, ...problem }) => ({
          ...problem,
          solved: done.length > 0,
        })),
      };
    }),
  );

  return { standings, practice, reviewed: attempts.length > 0 };
}
export type Practice = Awaited<ReturnType<typeof getPractice>>;
