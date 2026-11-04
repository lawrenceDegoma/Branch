-- CreateEnum
CREATE TYPE "ReactionKind" AS ENUM ('KUDOS', 'IMPRESSIVE', 'HELPFUL', 'SAME_HERE');

-- AlterEnum
ALTER TYPE "GroupAuditAction" ADD VALUE 'COMMENT_REMOVED';

-- CreateTable
CREATE TABLE "reaction" (
    "postId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ReactionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reaction_pkey" PRIMARY KEY ("postId","userId","kind")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" UUID,
    "body" TEXT,
    "spoiler" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reaction_userId_idx" ON "reaction"("userId");

-- CreateIndex
CREATE INDEX "comment_postId_parentId_id_idx" ON "comment"("postId", "parentId", "id");

-- CreateIndex
CREATE INDEX "comment_parentId_id_idx" ON "comment"("parentId", "id");

-- CreateIndex
CREATE INDEX "comment_authorId_createdAt_idx" ON "comment"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A live comment has 1-2000 characters, not only whitespace; a deleted one (kept because it has
-- replies) has no text. Both branches test NULL explicitly, so neither can evaluate to NULL.
ALTER TABLE "comment" ADD CONSTRAINT "comment_body" CHECK (
  ("deletedAt" IS NULL AND "body" IS NOT NULL AND "body" ~ '\S' AND char_length("body") <= 2000)
  OR ("deletedAt" IS NOT NULL AND "body" IS NULL)
);

-- Two levels: a reply's parent is a top-level comment on the same post, and a comment that has
-- replies can't itself become a reply.
CREATE FUNCTION "branch_check_comment_parent"() RETURNS trigger AS $$
BEGIN
  IF NEW."parentId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM "comment"
      WHERE "id" = NEW."parentId" AND "postId" = NEW."postId" AND "parentId" IS NULL
    ) THEN
      RAISE EXCEPTION 'Comment % must reply to a top-level comment on post %',
        NEW."id", NEW."postId" USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM "comment" WHERE "parentId" = NEW."id") THEN
      RAISE EXCEPTION 'Comment % has replies and cannot become a reply', NEW."id"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "comment_two_levels"
  BEFORE INSERT OR UPDATE OF "parentId", "postId" ON "comment"
  FOR EACH ROW EXECUTE FUNCTION "branch_check_comment_parent"();
