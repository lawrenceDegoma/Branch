-- CreateEnum
CREATE TYPE "StudySharing" AS ENUM ('ASK', 'GROUP', 'NEVER');

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "studySessionId" UUID;

-- AlterTable
ALTER TABLE "profile" ADD COLUMN     "studyShareGroupId" UUID,
ADD COLUMN     "studySharing" "StudySharing" NOT NULL DEFAULT 'ASK';

-- CreateTable
CREATE TABLE "study_session" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "autoStopped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "study_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_session_userId_startedAt_idx" ON "study_session"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "study_session_id_userId_key" ON "study_session"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "post_studySessionId_groupId_key" ON "post"("studySessionId", "groupId");

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_studyShareGroupId_fkey" FOREIGN KEY ("studyShareGroupId") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_studySessionId_authorId_fkey" FOREIGN KEY ("studySessionId", "authorId") REFERENCES "study_session"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One running session per person.
CREATE UNIQUE INDEX "study_session_one_running" ON "study_session"("userId") WHERE "endedAt" IS NULL;

-- A finished session ends after it starts and counts at most 4 hours; only a finished one can
-- have been stopped automatically.
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_length" CHECK (
  "endedAt" IS NULL OR ("endedAt" > "startedAt" AND "endedAt" <= "startedAt" + interval '4 hours')
);
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_auto_stopped" CHECK (
  NOT "autoStopped" OR "endedAt" IS NOT NULL
);

-- A remembered group goes with "always share" only. (It's cleared if the group is deleted, which
-- leaves GROUP with no group: Branch then asks again.)
ALTER TABLE "profile" ADD CONSTRAINT "profile_study_share_group" CHECK (
  "studyShareGroupId" IS NULL OR "studySharing" = 'GROUP'
);

-- A STUDY post shares exactly one session, and only a STUDY post does.
ALTER TABLE "post" ADD CONSTRAINT "post_study_session_kind" CHECK (
  ("studySessionId" IS NOT NULL) = ("kind" = 'STUDY')
);

-- Bodies: required for member-written posts; an optional note (up to 500 characters) on a shared
-- session; none on automatic posts.
ALTER TABLE "post" DROP CONSTRAINT "post_body_length";
ALTER TABLE "post" ADD CONSTRAINT "post_body_length" CHECK (
  ("kind" = 'TEXT' AND "body" IS NOT NULL AND "body" ~ '\S' AND char_length("body") <= 5000)
  OR ("kind" = 'STUDY' AND ("body" IS NULL OR ("body" ~ '\S' AND char_length("body") <= 500)))
  OR ("kind" NOT IN ('TEXT', 'STUDY') AND "body" IS NULL)
);

-- A shared session is like a member-written post without a problem, plan, or edits; its author
-- deletes it rather than hiding it. Every branch is built from IS [NOT] NULL tests.
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
    WHEN 'STUDY' THEN "problemId" IS NULL AND "planId" IS NULL AND "weekNumber" IS NULL
      AND NOT "spoiler" AND "editedAt" IS NULL AND "hiddenAt" IS NULL AND "withdrawnAt" IS NULL
    ELSE false
  END
);
