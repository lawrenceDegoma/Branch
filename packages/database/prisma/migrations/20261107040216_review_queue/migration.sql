-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('AGAIN', 'HARD', 'GOOD', 'EASY');

-- CreateTable
CREATE TABLE "review_schedule" (
    "userId" TEXT NOT NULL,
    "problemId" UUID NOT NULL,
    "dueOn" DATE NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "ease" INTEGER NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "review_schedule_pkey" PRIMARY KEY ("userId","problemId")
);

-- CreateTable
CREATE TABLE "review_attempt" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" UUID NOT NULL,
    "outcome" "ReviewOutcome" NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL,

    CONSTRAINT "review_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_schedule_userId_dueOn_idx" ON "review_schedule"("userId", "dueOn");

-- CreateIndex
CREATE INDEX "review_attempt_userId_id_idx" ON "review_attempt"("userId", "id");

-- CreateIndex
CREATE INDEX "review_attempt_userId_problemId_idx" ON "review_attempt"("userId", "problemId");

-- AddForeignKey
ALTER TABLE "review_schedule" ADD CONSTRAINT "review_schedule_userId_problemId_fkey" FOREIGN KEY ("userId", "problemId") REFERENCES "problem_completion"("userId", "problemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_attempt" ADD CONSTRAINT "review_attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_attempt" ADD CONSTRAINT "review_attempt_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints Prisma can't express. Every CHECK handles NULL explicitly.
ALTER TABLE "review_schedule"
  ADD CONSTRAINT "review_schedule_interval" CHECK (
    "intervalDays" IS NOT NULL AND "intervalDays" BETWEEN 1 AND 365
  ),
  ADD CONSTRAINT "review_schedule_ease" CHECK ("ease" IS NOT NULL AND "ease" BETWEEN 130 AND 300),
  ADD CONSTRAINT "review_schedule_count" CHECK ("reviewCount" IS NOT NULL AND "reviewCount" >= 0);

ALTER TABLE "review_attempt"
  ADD CONSTRAINT "review_attempt_interval" CHECK (
    "intervalDays" IS NOT NULL AND "intervalDays" BETWEEN 1 AND 365
  );

-- Problems solved before reviews existed join the queue gradually: three a day per person, oldest
-- solve first, starting tomorrow in their timezone. A recent solve still waits the usual three
-- days after it was solved.
INSERT INTO "review_schedule" ("userId", "problemId", "dueOn", "intervalDays", "ease")
SELECT
  "userId",
  "problemId",
  GREATEST(today + 1 + ((position - 1) / 3)::int, solved_on + 3),
  3,
  250
FROM (
  SELECT
    c."userId",
    c."problemId",
    (now() AT TIME ZONE COALESCE(p."timezone", 'UTC'))::date AS today,
    (c."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE COALESCE(p."timezone", 'UTC'))::date AS solved_on,
    row_number() OVER (PARTITION BY c."userId" ORDER BY c."completedAt", c."problemId") AS position
  FROM "problem_completion" c
  LEFT JOIN "profile" p ON p."userId" = c."userId"
) backlog;
