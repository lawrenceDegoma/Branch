-- Synced submissions record which site they were made on. Existing ones all came from LeetCode,
-- so the old value is renamed in place (no rows are rewritten), and neetcode.io is added.
ALTER TYPE "SubmissionSource" RENAME VALUE 'EXTENSION' TO 'LEETCODE';
ALTER TYPE "SubmissionSource" ADD VALUE 'NEETCODE';
