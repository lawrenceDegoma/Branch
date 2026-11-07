-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisOutcome" AS ENUM ('OK', 'UNPARSEABLE', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "AnalysisConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "submission" ALTER COLUMN "externalId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "analysis_result" (
    "id" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "problemSlug" TEXT NOT NULL,
    "analyzerVersion" TEXT NOT NULL,
    "outcome" "AnalysisOutcome" NOT NULL,
    "time" TEXT,
    "space" TEXT,
    "confidence" "AnalysisConfidence",
    "reasons" TEXT[],
    "limitations" TEXT[],
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_job" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "resultId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "analysis_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analysis_result_codeHash_language_problemSlug_analyzerVersi_key" ON "analysis_result"("codeHash", "language", "problemSlug", "analyzerVersion");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_job_submissionId_key" ON "analysis_job"("submissionId");

-- CreateIndex
CREATE INDEX "analysis_job_status_createdAt_idx" ON "analysis_job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "analysis_job_userId_finishedAt_idx" ON "analysis_job"("userId", "finishedAt");

-- CreateIndex
CREATE INDEX "analysis_job_resultId_idx" ON "analysis_job"("resultId");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_job_submissionId_userId_key" ON "analysis_job"("submissionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_id_userId_key" ON "submission"("id", "userId");

-- AddForeignKey
ALTER TABLE "analysis_job" ADD CONSTRAINT "analysis_job_submissionId_userId_fkey" FOREIGN KEY ("submissionId", "userId") REFERENCES "submission"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_job" ADD CONSTRAINT "analysis_job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_job" ADD CONSTRAINT "analysis_job_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "analysis_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Constraints Prisma can't express. Every CHECK handles NULL explicitly.

-- Pasted solutions have no site ID; synced ones always do.
ALTER TABLE "submission" DROP CONSTRAINT "submission_external_id";
ALTER TABLE "submission"
  ADD CONSTRAINT "submission_external_id" CHECK (
    ("source" = 'PASTED' AND "externalId" IS NULL)
    OR ("source" <> 'PASTED' AND "externalId" IS NOT NULL AND "externalId" ~ '^[0-9]{1,20}$')
  );

ALTER TABLE "analysis_result"
  ADD CONSTRAINT "analysis_result_code_hash" CHECK (
    "codeHash" IS NOT NULL AND "codeHash" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "analysis_result_estimate" CHECK (
    ("outcome" = 'OK' AND "time" IS NOT NULL AND "space" IS NOT NULL AND "confidence" IS NOT NULL)
    OR ("outcome" <> 'OK' AND "time" IS NULL AND "space" IS NULL AND "confidence" IS NULL)
  ),
  ADD CONSTRAINT "analysis_result_sizes" CHECK (
    char_length("analyzerVersion") BETWEEN 1 AND 40
    AND ("time" IS NULL OR char_length("time") <= 40)
    AND ("space" IS NULL OR char_length("space") <= 40)
    AND ("message" IS NULL OR char_length("message") <= 500)
    AND cardinality("reasons") <= 20
    AND cardinality("limitations") <= 20
  );

ALTER TABLE "analysis_job"
  ADD CONSTRAINT "analysis_job_attempts" CHECK ("attempts" IS NOT NULL AND "attempts" BETWEEN 0 AND 3),
  ADD CONSTRAINT "analysis_job_done_has_result" CHECK (
    ("status" = 'DONE' AND "resultId" IS NOT NULL) OR ("status" <> 'DONE' AND "resultId" IS NULL)
  );
