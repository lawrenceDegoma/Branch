-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'SPOILER', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'DISMISSED');

-- CreateTable
CREATE TABLE "report" (
    "id" UUID NOT NULL,
    "reporterId" TEXT NOT NULL,
    "groupId" UUID NOT NULL,
    "postId" UUID,
    "commentId" UUID,
    "reason" "ReportReason" NOT NULL,
    "note" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_block" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateIndex
CREATE INDEX "report_groupId_status_idx" ON "report"("groupId", "status");

-- CreateIndex
CREATE INDEX "report_postId_idx" ON "report"("postId");

-- CreateIndex
CREATE INDEX "report_commentId_idx" ON "report"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "report_reporterId_postId_key" ON "report"("reporterId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "report_reporterId_commentId_key" ON "report"("reporterId", "commentId");

-- CreateIndex
CREATE INDEX "user_block_blockedId_idx" ON "user_block"("blockedId");

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A report names exactly one post or comment, and its note (if any) has text.
ALTER TABLE "report" ADD CONSTRAINT "report_one_target" CHECK (num_nonnulls("postId", "commentId") = 1);
ALTER TABLE "report" ADD CONSTRAINT "report_note" CHECK (
  "note" IS NULL OR ("note" ~ '\S' AND char_length("note") <= 500)
);
-- Dismissed exactly when it has a resolution time.
ALTER TABLE "report" ADD CONSTRAINT "report_resolved" CHECK (
  ("status" = 'OPEN') = ("resolvedAt" IS NULL)
);

-- A report belongs to the group its post (or its comment's post) is in.
CREATE FUNCTION "branch_check_report_group"() RETURNS trigger AS $$
DECLARE
  target_group uuid;
BEGIN
  -- No target, or two: report_one_target says so (triggers run before CHECKs).
  IF num_nonnulls(NEW."postId", NEW."commentId") <> 1 THEN
    RETURN NEW;
  END IF;
  IF NEW."postId" IS NOT NULL THEN
    SELECT "groupId" INTO target_group FROM "post" WHERE "id" = NEW."postId";
  ELSE
    SELECT p."groupId" INTO target_group
    FROM "comment" c JOIN "post" p ON p."id" = c."postId"
    WHERE c."id" = NEW."commentId";
  END IF;
  IF target_group IS DISTINCT FROM NEW."groupId" THEN
    RAISE EXCEPTION 'report_group_mismatch' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "report_in_group"
  BEFORE INSERT OR UPDATE OF "groupId", "postId", "commentId" ON "report"
  FOR EACH ROW EXECUTE FUNCTION "branch_check_report_group"();

-- Nobody blocks themselves.
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_not_self" CHECK ("blockerId" <> "blockedId");
