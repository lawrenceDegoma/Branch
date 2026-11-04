-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('TEXT', 'SOLVE', 'WEEK_DONE', 'PLAN_DONE');

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "kind" "PostKind" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "planId" UUID,
ADD COLUMN     "weekNumber" INTEGER,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ALTER COLUMN "body" DROP NOT NULL;

-- AlterTable
ALTER TABLE "profile" ADD COLUMN     "shareSolves" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_planId_fkey" FOREIGN KEY ("planId") REFERENCES "group_roadmap_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A milestone's plan is always a plan of the post's own group. A trigger rather than a composite
-- foreign key, which Prisma can't model for an optional relation. Plans never change group.
CREATE FUNCTION "branch_check_post_plan_group"() RETURNS trigger AS $$
BEGIN
  IF NEW."planId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "group_roadmap_plan" WHERE "id" = NEW."planId" AND "groupId" = NEW."groupId"
  ) THEN
    RAISE EXCEPTION 'Plan % does not belong to group %', NEW."planId", NEW."groupId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "post_plan_in_group"
  BEFORE INSERT OR UPDATE OF "planId", "groupId" ON "post"
  FOR EACH ROW EXECUTE FUNCTION "branch_check_post_plan_group"();

-- Only member-written posts have a body; the length rule is unchanged for them.
ALTER TABLE "post" DROP CONSTRAINT "post_body_length";
ALTER TABLE "post" ADD CONSTRAINT "post_body_length" CHECK (
  ("kind" = 'TEXT' AND "body" IS NOT NULL AND "body" ~ '\S' AND char_length("body") <= 5000)
  OR ("kind" <> 'TEXT' AND "body" IS NULL)
);

-- Which columns each kind uses. Every branch is built from IS [NOT] NULL tests (and a range test
-- guarded by one), so none can evaluate to NULL and slip through.
ALTER TABLE "post" ADD CONSTRAINT "post_kind_shape" CHECK (
  CASE "kind"
    WHEN 'TEXT' THEN "planId" IS NULL AND "weekNumber" IS NULL
      AND "hiddenAt" IS NULL AND "withdrawnAt" IS NULL
    WHEN 'SOLVE' THEN "problemId" IS NOT NULL AND "planId" IS NULL AND "weekNumber" IS NULL
      AND NOT "spoiler" AND "editedAt" IS NULL
    WHEN 'WEEK_DONE' THEN "problemId" IS NULL AND "planId" IS NOT NULL
      AND "weekNumber" IS NOT NULL AND "weekNumber" >= 1 AND NOT "spoiler" AND "editedAt" IS NULL
    WHEN 'PLAN_DONE' THEN "problemId" IS NULL AND "planId" IS NOT NULL AND "weekNumber" IS NULL
      AND NOT "spoiler" AND "editedAt" IS NULL
    ELSE false
  END
);

-- Each automatic post exists at most once per author, so repeated or racing solves can't post
-- twice. Undoing a solve withdraws the post rather than deleting it.
CREATE UNIQUE INDEX "post_solve_once" ON "post"("authorId", "groupId", "problemId")
  WHERE "kind" = 'SOLVE';
CREATE UNIQUE INDEX "post_week_done_once" ON "post"("authorId", "planId", "weekNumber")
  WHERE "kind" = 'WEEK_DONE';
CREATE UNIQUE INDEX "post_plan_done_once" ON "post"("authorId", "planId")
  WHERE "kind" = 'PLAN_DONE';
