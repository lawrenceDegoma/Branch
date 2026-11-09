-- A re-solve post is shaped like a solve post: a problem, no plan or week, no body, never a
-- spoiler or edited. Unlike SOLVE it can repeat (no unique index); the weekly limit is enforced
-- by the service under an advisory lock. Every branch is built from IS [NOT] NULL tests.
ALTER TABLE "post" DROP CONSTRAINT "post_kind_shape";
ALTER TABLE "post" ADD CONSTRAINT "post_kind_shape" CHECK (
  CASE "kind"
    WHEN 'TEXT' THEN "planId" IS NULL AND "weekNumber" IS NULL
      AND "hiddenAt" IS NULL AND "withdrawnAt" IS NULL
    WHEN 'SOLVE' THEN "problemId" IS NOT NULL AND "planId" IS NULL AND "weekNumber" IS NULL
      AND NOT "spoiler" AND "editedAt" IS NULL
    WHEN 'RESOLVE' THEN "problemId" IS NOT NULL AND "planId" IS NULL AND "weekNumber" IS NULL
      AND NOT "spoiler" AND "editedAt" IS NULL
    WHEN 'WEEK_DONE' THEN "problemId" IS NULL AND "planId" IS NOT NULL
      AND "weekNumber" IS NOT NULL AND "weekNumber" >= 1 AND NOT "spoiler" AND "editedAt" IS NULL
    WHEN 'PLAN_DONE' THEN "problemId" IS NULL AND "planId" IS NOT NULL AND "weekNumber" IS NULL
      AND NOT "spoiler" AND "editedAt" IS NULL
    ELSE false
  END
);

-- Finding a person's latest solve or re-solve post for a problem, for the weekly limit.
CREATE INDEX "post_solves_by_author" ON "post"("authorId", "problemId", "createdAt")
  WHERE "kind" IN ('SOLVE', 'RESOLVE');
