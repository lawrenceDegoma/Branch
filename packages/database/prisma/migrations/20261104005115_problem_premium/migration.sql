-- AlterTable
ALTER TABLE "problem" ADD COLUMN     "freeAlternativeUrl" TEXT,
ADD COLUMN     "premium" BOOLEAN NOT NULL DEFAULT false;

-- A free alternative must be an https URL of reasonable length. NULL (no alternative) is allowed
-- explicitly, since a CHECK that evaluates to NULL passes.
ALTER TABLE "problem" ADD CONSTRAINT "problem_free_alternative_url_check"
  CHECK ("freeAlternativeUrl" IS NULL OR ("freeAlternativeUrl" LIKE 'https://%' AND length("freeAlternativeUrl") <= 300));
