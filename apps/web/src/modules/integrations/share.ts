import "server-only";
import { prisma } from "@branch/database";
import { DomainError, NotFoundError } from "@/lib/errors";
import { POST_BODY_MAX } from "@/modules/feed/schemas";
import { createPost } from "@/modules/feed/service";
import { codeFence, languageLabel } from "./languages";
import { shareSolutionSchema } from "./schemas";

// Sharing a solution is the only way its code or analysis reaches a group: the person picks the
// group and whether to include the code, every time. It becomes an ordinary post of theirs, which
// they can edit or delete like any other.

const CONFIDENCE = { HIGH: "high", MEDIUM: "medium", LOW: "low" } as const;

export async function shareSolution(userId: string, input: unknown, now = new Date()) {
  const parsed = shareSolutionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new DomainError("INVALID", issue.message, String(issue.path[0] ?? "groupId"));
  }
  const { submissionId, groupId, note, includeCode } = parsed.data;
  const solution = await prisma.submission.findFirst({
    where: { id: submissionId, userId },
    select: {
      code: true,
      language: true,
      problemSlug: true,
      problemId: true,
      problem: { select: { title: true } },
      user: { select: { profile: { select: { analyzeSolutions: true } } } },
      analysis: {
        select: {
          status: true,
          result: {
            select: {
              outcome: true,
              time: true,
              space: true,
              confidence: true,
              notation: true,
              bound: true,
            },
          },
        },
      },
    },
  });
  if (!solution) throw new NotFoundError("We couldn't find that solution.");

  const title = solution.problem?.title ?? solution.problemSlug;
  const result = solution.analysis?.result;
  const analysisOn = solution.user.profile?.analyzeSolutions !== false;
  const estimate =
    analysisOn && result?.outcome === "OK" && result.time && result.space && result.confidence
      ? [
          `Branch's estimate: ${result.bound ? "at most" : "probably"} ${result.time} time and ${result.space} space, ${CONFIDENCE[result.confidence]} confidence. It's read from the code, so it can be wrong.`,
          result.notation,
        ]
          .filter(Boolean)
          .join(" ")
      : null;
  if (!estimate && !includeCode) {
    throw new DomainError(
      "NOTHING_TO_SHARE",
      "This solution has no estimate yet, so include your code to share it.",
      "includeCode",
    );
  }

  const body = [
    `Shared my solution to **${title}** (${languageLabel(solution.language)}).`,
    note,
    estimate,
    includeCode ? codeFence(solution.code, solution.language) : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (body.length > POST_BODY_MAX) {
    throw new DomainError(
      "TOO_LONG",
      `With its code this would be longer than a post can be (${POST_BODY_MAX.toLocaleString("en")} characters). Share it without the code.`,
      "includeCode",
    );
  }
  return createPost(
    userId,
    { groupId, body, problemId: solution.problemId, spoiler: includeCode },
    now,
  );
}
