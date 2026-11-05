-- CreateEnum
CREATE TYPE "SubmissionSource" AS ENUM ('EXTENSION');

-- CreateTable
CREATE TABLE "extension_connection" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "extension_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "SubmissionSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "problemSlug" TEXT NOT NULL,
    "problemId" UUID,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extension_connection_tokenHash_key" ON "extension_connection"("tokenHash");

-- CreateIndex
CREATE INDEX "extension_connection_userId_idx" ON "extension_connection"("userId");

-- CreateIndex
CREATE INDEX "submission_userId_receivedAt_idx" ON "submission"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "submission_problemSlug_idx" ON "submission"("problemSlug");

-- CreateIndex
CREATE UNIQUE INDEX "submission_userId_source_externalId_key" ON "submission"("userId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "extension_connection" ADD CONSTRAINT "extension_connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Constraints Prisma can't express. Every CHECK handles NULL explicitly.
ALTER TABLE "extension_connection"
  ADD CONSTRAINT "extension_connection_token_hash" CHECK (
    "tokenHash" IS NOT NULL AND "tokenHash" ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE "submission"
  ADD CONSTRAINT "submission_external_id" CHECK (
    "externalId" IS NOT NULL AND "externalId" ~ '^[0-9]{1,20}$'
  ),
  ADD CONSTRAINT "submission_slug_format" CHECK (
    "problemSlug" IS NOT NULL AND "problemSlug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  ADD CONSTRAINT "submission_language" CHECK (
    "language" IS NOT NULL AND "language" ~ '^[A-Za-z0-9+#._-]{1,40}$'
  ),
  ADD CONSTRAINT "submission_code" CHECK (
    "code" IS NOT NULL AND char_length("code") BETWEEN 1 AND 100000
  );

-- The daily cleanup finds unmatched submissions by age.
CREATE INDEX "submission_unmatched_received" ON "submission" ("receivedAt") WHERE "problemId" IS NULL;

-- A matched submission must point at the problem with its own slug.
CREATE FUNCTION branch_check_submission_problem() RETURNS trigger AS $$
BEGIN
  IF NEW."problemId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "problem" WHERE "id" = NEW."problemId" AND "leetcodeSlug" = NEW."problemSlug"
  ) THEN
    RAISE EXCEPTION 'submission problem must match its slug' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "submission_problem_matches_slug"
  BEFORE INSERT OR UPDATE OF "problemId", "problemSlug" ON "submission"
  FOR EACH ROW EXECUTE FUNCTION branch_check_submission_problem();
