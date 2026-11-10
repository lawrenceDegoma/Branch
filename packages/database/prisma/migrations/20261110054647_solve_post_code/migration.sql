-- AlterTable
ALTER TABLE "post" ADD COLUMN     "submissionId" UUID;

-- AlterTable
ALTER TABLE "profile" ADD COLUMN     "attachSolutions" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "post_submissionId_idx" ON "post"("submissionId");

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_submissionId_authorId_fkey" FOREIGN KEY ("submissionId", "authorId") REFERENCES "submission"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Only a solve or a re-solve post carries code.
ALTER TABLE "post" ADD CONSTRAINT "post_submission_kind" CHECK (
  "submissionId" IS NULL OR "kind" IN ('SOLVE', 'RESOLVE')
);

-- Code goes on solve posts only while solve posts are shared at all.
ALTER TABLE "profile" ADD CONSTRAINT "profile_attach_solutions" CHECK (
  NOT "attachSolutions" OR "shareSolves"
);
