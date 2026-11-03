-- The original pacing CHECK let PER_WEEK through with a NULL problemsPerWeek: NULL BETWEEN 1 AND 50
-- is NULL, and a CHECK that evaluates to NULL passes. Require the value explicitly.
ALTER TABLE "group_roadmap_plan" DROP CONSTRAINT "group_roadmap_plan_pacing_consistent";

ALTER TABLE "group_roadmap_plan"
  ADD CONSTRAINT "group_roadmap_plan_pacing_consistent" CHECK (
    ("pacing" = 'PER_WEEK' AND "problemsPerWeek" IS NOT NULL AND "problemsPerWeek" BETWEEN 1 AND 50)
    OR ("pacing" = 'PER_SECTION' AND "problemsPerWeek" IS NULL)
  );
