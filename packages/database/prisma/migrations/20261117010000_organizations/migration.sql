-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('SCHOOL', 'COMPANY');

-- AlterTable
ALTER TABLE "profile" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "showAffiliation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "kind" "OrganizationKind" NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_kind_idx" ON "organization"("kind");

-- CreateIndex
CREATE INDEX "profile_schoolId_idx" ON "profile"("schoolId");

-- CreateIndex
CREATE INDEX "profile_companyId_idx" ON "profile"("companyId");

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- An ID names its kind, so a profile's school is always a school and its company a company.
ALTER TABLE "organization" ADD CONSTRAINT "organization_id_kind" CHECK (
  ("kind" = 'SCHOOL' AND "id" LIKE 'school:%') OR ("kind" = 'COMPANY' AND "id" LIKE 'company:%')
);
ALTER TABLE "organization" ADD CONSTRAINT "organization_name_length" CHECK (
  char_length("name") BETWEEN 1 AND 200
);
ALTER TABLE "organization" ADD CONSTRAINT "organization_country_code" CHECK (
  "country" IS NULL OR "country" ~ '^[A-Z]{2}$'
);
ALTER TABLE "profile" ADD CONSTRAINT "profile_school_kind" CHECK (
  "schoolId" IS NULL OR "schoolId" LIKE 'school:%'
);
ALTER TABLE "profile" ADD CONSTRAINT "profile_company_kind" CHECK (
  "companyId" IS NULL OR "companyId" LIKE 'company:%'
);
