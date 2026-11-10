-- AlterTable
ALTER TABLE "profile" ADD COLUMN     "changelogSeenId" TEXT;

-- A changelog entry ID: a date and a slug, as in apps/web/src/modules/changelog/entries.ts.
ALTER TABLE "profile" ADD CONSTRAINT "profile_changelog_seen_id" CHECK (
  "changelogSeenId" IS NULL OR "changelogSeenId" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$'
);
