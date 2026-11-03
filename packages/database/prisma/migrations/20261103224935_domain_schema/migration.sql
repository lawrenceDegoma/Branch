-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "GroupAuditAction" AS ENUM ('GROUP_CREATED', 'GROUP_UPDATED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_REMOVED', 'ADMIN_TRANSFERRED', 'INVITE_CREATED', 'INVITE_REVOKED', 'PLAN_CHANGED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ProblemSource" AS ENUM ('SEED', 'CURATED', 'USER');

-- CreateEnum
CREATE TYPE "RoadmapKind" AS ENUM ('CURATED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RoadmapVisibility" AS ENUM ('PRIVATE', 'LINK');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompletionSource" AS ENUM ('MANUAL', 'EXTENSION', 'IMPORT');

-- CreateTable
CREATE TABLE "group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "timezone" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_membership" (
    "groupId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_membership_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "group_invite" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_audit_event" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "action" "GroupAuditAction" NOT NULL,
    "actorId" TEXT,
    "subjectUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem" (
    "id" UUID NOT NULL,
    "leetcodeSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "source" "ProblemSource" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_tag" (
    "problemId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "problem_tag_pkey" PRIMARY KEY ("problemId","tagId")
);

-- CreateTable
CREATE TABLE "roadmap" (
    "id" UUID NOT NULL,
    "kind" "RoadmapKind" NOT NULL,
    "slug" TEXT,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "RoadmapVisibility" NOT NULL DEFAULT 'PRIVATE',
    "shareToken" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_version" (
    "id" UUID NOT NULL,
    "roadmapId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_section" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "roadmap_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_item" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "roadmap_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_roadmap_plan" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "roadmapVersionId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "group_roadmap_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_assignment" (
    "planId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "roadmapItemId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,

    CONSTRAINT "weekly_assignment_pkey" PRIMARY KEY ("planId","roadmapItemId")
);

-- CreateTable
CREATE TABLE "problem_completion" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" UUID NOT NULL,
    "source" "CompletionSource" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_completion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_membership_userId_idx" ON "group_membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "group_invite_tokenHash_key" ON "group_invite"("tokenHash");

-- CreateIndex
CREATE INDEX "group_invite_groupId_idx" ON "group_invite"("groupId");

-- CreateIndex
CREATE INDEX "group_audit_event_groupId_createdAt_idx" ON "group_audit_event"("groupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "problem_leetcodeSlug_key" ON "problem"("leetcodeSlug");

-- CreateIndex
CREATE UNIQUE INDEX "tag_slug_key" ON "tag"("slug");

-- CreateIndex
CREATE INDEX "problem_tag_tagId_idx" ON "problem_tag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_slug_key" ON "roadmap"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_shareToken_key" ON "roadmap"("shareToken");

-- CreateIndex
CREATE INDEX "roadmap_ownerId_idx" ON "roadmap"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_version_roadmapId_number_key" ON "roadmap_version"("roadmapId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_section_versionId_position_key" ON "roadmap_section"("versionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_section_id_versionId_key" ON "roadmap_section"("id", "versionId");

-- CreateIndex
CREATE INDEX "roadmap_item_problemId_idx" ON "roadmap_item"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_item_sectionId_position_key" ON "roadmap_item"("sectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_item_versionId_problemId_key" ON "roadmap_item"("versionId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_item_id_versionId_key" ON "roadmap_item"("id", "versionId");

-- CreateIndex
CREATE INDEX "group_roadmap_plan_groupId_idx" ON "group_roadmap_plan"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "group_roadmap_plan_id_roadmapVersionId_key" ON "group_roadmap_plan"("id", "roadmapVersionId");

-- CreateIndex
CREATE INDEX "weekly_assignment_planId_weekNumber_idx" ON "weekly_assignment"("planId", "weekNumber");

-- CreateIndex
CREATE INDEX "problem_completion_problemId_idx" ON "problem_completion"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "problem_completion_userId_problemId_key" ON "problem_completion"("userId", "problemId");

-- AddForeignKey
ALTER TABLE "group" ADD CONSTRAINT "group_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invite" ADD CONSTRAINT "group_invite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invite" ADD CONSTRAINT "group_invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_audit_event" ADD CONSTRAINT "group_audit_event_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_audit_event" ADD CONSTRAINT "group_audit_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_audit_event" ADD CONSTRAINT "group_audit_event_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem" ADD CONSTRAINT "problem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_tag" ADD CONSTRAINT "problem_tag_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_tag" ADD CONSTRAINT "problem_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_version" ADD CONSTRAINT "roadmap_version_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_section" ADD CONSTRAINT "roadmap_section_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "roadmap_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_item" ADD CONSTRAINT "roadmap_item_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "roadmap_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_item" ADD CONSTRAINT "roadmap_item_sectionId_versionId_fkey" FOREIGN KEY ("sectionId", "versionId") REFERENCES "roadmap_section"("id", "versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_item" ADD CONSTRAINT "roadmap_item_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_roadmap_plan" ADD CONSTRAINT "group_roadmap_plan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_roadmap_plan" ADD CONSTRAINT "group_roadmap_plan_roadmapVersionId_fkey" FOREIGN KEY ("roadmapVersionId") REFERENCES "roadmap_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_roadmap_plan" ADD CONSTRAINT "group_roadmap_plan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_assignment" ADD CONSTRAINT "weekly_assignment_planId_versionId_fkey" FOREIGN KEY ("planId", "versionId") REFERENCES "group_roadmap_plan"("id", "roadmapVersionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_assignment" ADD CONSTRAINT "weekly_assignment_roadmapItemId_versionId_fkey" FOREIGN KEY ("roadmapItemId", "versionId") REFERENCES "roadmap_item"("id", "versionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_completion" ADD CONSTRAINT "problem_completion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_completion" ADD CONSTRAINT "problem_completion_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================================
-- Constraints Prisma cannot express
-- =============================================================================================

-- Groups -------------------------------------------------------------------------------------

ALTER TABLE "group"
  ADD CONSTRAINT "group_name_length" CHECK (char_length(btrim("name")) BETWEEN 1 AND 60),
  ADD CONSTRAINT "group_description_length" CHECK ("description" IS NULL OR char_length("description") <= 280);

-- At most one admin per group. The service layer keeps it at exactly one.
CREATE UNIQUE INDEX "group_membership_one_admin" ON "group_membership" ("groupId") WHERE "role" = 'ADMIN';

ALTER TABLE "group_invite"
  ADD CONSTRAINT "group_invite_max_uses_positive" CHECK ("maxUses" IS NULL OR "maxUses" > 0),
  ADD CONSTRAINT "group_invite_use_count_bounds" CHECK ("useCount" >= 0 AND ("maxUses" IS NULL OR "useCount" <= "maxUses"));

-- Catalog ------------------------------------------------------------------------------------

ALTER TABLE "problem"
  ADD CONSTRAINT "problem_slug_format" CHECK ("leetcodeSlug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT "problem_title_length" CHECK (char_length(btrim("title")) BETWEEN 1 AND 200);

ALTER TABLE "tag"
  ADD CONSTRAINT "tag_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Roadmaps -----------------------------------------------------------------------------------

ALTER TABLE "roadmap"
  ADD CONSTRAINT "roadmap_title_length" CHECK (char_length(btrim("title")) BETWEEN 1 AND 80),
  ADD CONSTRAINT "roadmap_curated_has_no_owner" CHECK ("kind" <> 'CURATED' OR "ownerId" IS NULL),
  ADD CONSTRAINT "roadmap_share_token_matches_visibility" CHECK (("visibility" = 'LINK') = ("shareToken" IS NOT NULL));

ALTER TABLE "roadmap_version"
  ADD CONSTRAINT "roadmap_version_number_positive" CHECK ("number" >= 1);

-- At most one draft per roadmap.
CREATE UNIQUE INDEX "roadmap_version_one_draft" ON "roadmap_version" ("roadmapId") WHERE "publishedAt" IS NULL;

ALTER TABLE "roadmap_section"
  ADD CONSTRAINT "roadmap_section_position_nonnegative" CHECK ("position" >= 0),
  ADD CONSTRAINT "roadmap_section_title_length" CHECK (char_length(btrim("title")) BETWEEN 1 AND 80);

ALTER TABLE "roadmap_item"
  ADD CONSTRAINT "roadmap_item_position_nonnegative" CHECK ("position" >= 0);

-- Published versions are immutable: their sections and items cannot be inserted, updated, or
-- deleted, except when the version itself is being deleted (cascade).
CREATE FUNCTION "branch_reject_published_version_content_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  changed_version uuid;
BEGIN
  FOREACH changed_version IN ARRAY (
    CASE TG_OP
      WHEN 'INSERT' THEN ARRAY[NEW."versionId"]
      WHEN 'DELETE' THEN ARRAY[OLD."versionId"]
      ELSE ARRAY[OLD."versionId", NEW."versionId"]
    END
  ) LOOP
    IF EXISTS (
      SELECT 1 FROM "roadmap_version" WHERE "id" = changed_version AND "publishedAt" IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Roadmap version % is published and cannot be changed', changed_version
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "roadmap_section_published_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "roadmap_section"
  FOR EACH ROW EXECUTE FUNCTION "branch_reject_published_version_content_change"();

CREATE TRIGGER "roadmap_item_published_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "roadmap_item"
  FOR EACH ROW EXECUTE FUNCTION "branch_reject_published_version_content_change"();

-- A published version keeps its number, roadmap, and publication time.
CREATE FUNCTION "branch_reject_published_version_edit"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."publishedAt" IS NOT NULL AND (
    NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
    OR NEW."number" <> OLD."number"
    OR NEW."roadmapId" <> OLD."roadmapId"
  ) THEN
    RAISE EXCEPTION 'Roadmap version % is published and cannot be changed', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "roadmap_version_published_immutable"
  BEFORE UPDATE ON "roadmap_version"
  FOR EACH ROW EXECUTE FUNCTION "branch_reject_published_version_edit"();

-- Plans and progress -------------------------------------------------------------------------

-- At most one active plan per group.
CREATE UNIQUE INDEX "group_roadmap_plan_one_active" ON "group_roadmap_plan" ("groupId") WHERE "status" = 'ACTIVE';

ALTER TABLE "group_roadmap_plan"
  ADD CONSTRAINT "group_roadmap_plan_archived_at_matches_status" CHECK (("status" = 'ARCHIVED') = ("archivedAt" IS NOT NULL));

ALTER TABLE "weekly_assignment"
  ADD CONSTRAINT "weekly_assignment_week_positive" CHECK ("weekNumber" >= 1);

ALTER TABLE "problem_completion"
  ADD CONSTRAINT "problem_completion_language_length" CHECK ("language" IS NULL OR char_length("language") <= 40);
