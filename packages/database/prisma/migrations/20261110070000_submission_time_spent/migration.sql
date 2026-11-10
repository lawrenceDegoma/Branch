-- AlterTable
ALTER TABLE "submission" ADD COLUMN     "timeSpentSeconds" INTEGER;


-- From the extension's problem timer: at least a second, at most a day.
ALTER TABLE "submission" ADD CONSTRAINT "submission_time_spent" CHECK (
  "timeSpentSeconds" IS NULL OR "timeSpentSeconds" BETWEEN 1 AND 86400
);
