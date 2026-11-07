import type { ReviewOutcome } from "./schedule";

// How each topic is going, from the user's own reviews. A plain counting rule rather than a
// statistical model, so every result can be explained in one sentence: a topic needs practice
// when the user struggled (couldn't solve it, or struggled) on at least half of their last few
// reviews in it, or on two of them. Pure, so the rule is tested without a database.

/** How many of the latest reviews in a topic count. Older ones stop mattering as you improve. */
export const RECENT_REVIEWS = 5;

export type TopicRef = { slug: string; name: string };
export type TopicStatus = "needs-practice" | "going-well" | "not-reviewed";

export type TopicStanding = {
  topic: TopicRef;
  /** The topic's problems the user has solved, and how many Branch has. */
  solved: number;
  total: number;
  /** The latest RECENT_REVIEWS reviews in the topic, and how many of those were struggles. */
  reviews: number;
  struggled: number;
  status: TopicStatus;
};

const isStruggle = (outcome: ReviewOutcome) => outcome === "AGAIN" || outcome === "HARD";

export function needsPractice(reviews: number, struggled: number): boolean {
  return struggled >= 2 || (struggled >= 1 && struggled * 2 >= reviews);
}

/**
 * Every topic the user has solved or reviewed something in. Topics needing practice come first,
 * the most struggled first; then the rest by name.
 */
export function topicStandings(input: {
  /** Newest first. A review counts toward each topic of its problem. */
  attempts: { outcome: ReviewOutcome; topics: TopicRef[] }[];
  solvedByTopic: Map<string, number>;
  totalByTopic: Map<string, { topic: TopicRef; total: number }>;
}): TopicStanding[] {
  const recent = new Map<string, { topic: TopicRef; reviews: number; struggled: number }>();
  for (const attempt of input.attempts) {
    for (const topic of attempt.topics) {
      const entry = recent.get(topic.slug) ?? { topic, reviews: 0, struggled: 0 };
      if (entry.reviews >= RECENT_REVIEWS) continue;
      entry.reviews += 1;
      if (isStruggle(attempt.outcome)) entry.struggled += 1;
      recent.set(topic.slug, entry);
    }
  }

  const slugs = new Set([...input.solvedByTopic.keys(), ...recent.keys()]);
  const standings = [...slugs].flatMap((slug): TopicStanding[] => {
    const catalog = input.totalByTopic.get(slug);
    const topic = catalog?.topic ?? recent.get(slug)?.topic;
    if (!topic) return [];
    const { reviews = 0, struggled = 0 } = recent.get(slug) ?? {};
    const status: TopicStatus =
      reviews === 0
        ? "not-reviewed"
        : needsPractice(reviews, struggled)
          ? "needs-practice"
          : "going-well";
    return [
      {
        topic,
        solved: input.solvedByTopic.get(slug) ?? 0,
        total: catalog?.total ?? 0,
        reviews,
        struggled,
        status,
      },
    ];
  });

  const weak = (s: TopicStanding) => s.status === "needs-practice";
  return standings.sort(
    (a, b) =>
      Number(weak(b)) - Number(weak(a)) ||
      (weak(a)
        ? b.struggled / b.reviews - a.struggled / a.reviews || b.struggled - a.struggled
        : 0) ||
      a.topic.name.localeCompare(b.topic.name),
  );
}

/** Why a topic needs practice, e.g. "You struggled on 2 of your last 3 Sliding Window reviews." */
export function practiceReason({ topic, reviews, struggled }: TopicStanding): string {
  if (reviews === 1) return `You struggled on your one ${topic.name} review so far.`;
  if (struggled === reviews) {
    return `You struggled on ${reviews === 2 ? "both" : "all"} of your last ${reviews} ${topic.name} reviews.`;
  }
  return `You struggled on ${struggled} of your last ${reviews} ${topic.name} reviews.`;
}
