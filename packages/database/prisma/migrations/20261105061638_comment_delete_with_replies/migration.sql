-- Deleting a comment now deletes its replies with it (the parent foreign key already cascades),
-- so the "Comment deleted" placeholder goes away. Existing placeholders are removed first, taking
-- their replies with them, as if they had been deleted under the new rule.
DELETE FROM "comment" WHERE "deletedAt" IS NOT NULL;

-- The body CHECK referred to the placeholder state; every comment now has text.
ALTER TABLE "comment" DROP CONSTRAINT "comment_body";

-- AlterTable
ALTER TABLE "comment" DROP COLUMN "deletedAt",
ALTER COLUMN "body" SET NOT NULL;

ALTER TABLE "comment" ADD CONSTRAINT "comment_body" CHECK (
  "body" IS NOT NULL AND "body" ~ '\S' AND char_length("body") <= 2000
);
