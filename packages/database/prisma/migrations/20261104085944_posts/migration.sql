-- AlterEnum
ALTER TYPE "GroupAuditAction" ADD VALUE 'POST_REMOVED';

-- CreateTable
CREATE TABLE "post" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "problemId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_groupId_id_idx" ON "post"("groupId", "id" DESC);

-- CreateIndex
CREATE INDEX "post_authorId_createdAt_idx" ON "post"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "post_problemId_idx" ON "post"("problemId");

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Body: at most 5000 characters and not only whitespace (btrim alone keeps newlines and tabs).
-- The column is NOT NULL, so the CHECK can't pass on NULL.
ALTER TABLE "post"
  ADD CONSTRAINT "post_body_length" CHECK ("body" ~ '\S' AND char_length("body") <= 5000);
