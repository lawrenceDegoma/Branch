-- Solutions can be pasted into Branch as well as synced. On its own so the next migration can use
-- the new value (Postgres doesn't allow using an enum value in the transaction that adds it).
ALTER TYPE "SubmissionSource" ADD VALUE 'PASTED';
