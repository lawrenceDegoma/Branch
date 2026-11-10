-- Shared study sessions get their own post kind. On its own so the next migration can use it.
ALTER TYPE "PostKind" ADD VALUE 'STUDY';
