/*
  Warnings:

  - Added the required column `pacing` to the `group_roadmap_plan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlanPacing" AS ENUM ('PER_WEEK', 'PER_SECTION');

-- AlterTable
ALTER TABLE "group_roadmap_plan" ADD COLUMN     "pacing" "PlanPacing" NOT NULL,
ADD COLUMN     "problemsPerWeek" INTEGER;

ALTER TABLE "group_roadmap_plan"
  ADD CONSTRAINT "group_roadmap_plan_pacing_consistent" CHECK (
    ("pacing" = 'PER_WEEK' AND "problemsPerWeek" BETWEEN 1 AND 50)
    OR ("pacing" = 'PER_SECTION' AND "problemsPerWeek" IS NULL)
  );
