-- CreateEnum
CREATE TYPE "BadgeKind" AS ENUM ('FIRST_SOLVE', 'SOLVED_10', 'SOLVED_50', 'SOLVED_100', 'WEEK_DONE', 'ROADMAP_DONE', 'REVIEWS_25');

-- CreateTable
CREATE TABLE "badge_award" (
    "userId" TEXT NOT NULL,
    "kind" "BadgeKind" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_award_pkey" PRIMARY KEY ("userId","kind")
);

-- AddForeignKey
ALTER TABLE "badge_award" ADD CONSTRAINT "badge_award_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

