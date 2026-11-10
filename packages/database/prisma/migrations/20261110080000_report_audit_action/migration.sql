-- Dismissing reports is an admin action worth recording. On its own so the next migration can
-- use it.
ALTER TYPE "GroupAuditAction" ADD VALUE 'REPORT_DISMISSED';
