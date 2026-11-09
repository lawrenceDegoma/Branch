-- CreateEnum
CREATE TYPE "PhotoChoice" AS ENUM ('PROVIDER', 'UPLOAD', 'NONE');

-- AlterTable
ALTER TABLE "profile" ADD COLUMN     "photo" "PhotoChoice" NOT NULL DEFAULT 'PROVIDER',
ADD COLUMN     "photoChangedAt" TIMESTAMP(3),
ADD COLUMN     "photoUrl" TEXT;

-- An uploaded photo's address exists exactly while the upload is the chosen photo, and is either
-- a Vercel Blob URL (https) or, in development, Branch's own local photo route.
ALTER TABLE "profile" ADD CONSTRAINT "profile_photo_url" CHECK (
  ("photo" = 'UPLOAD') = ("photoUrl" IS NOT NULL)
  AND (
    "photoUrl" IS NULL
    OR (length("photoUrl") <= 500 AND "photoUrl" ~ '^(https://|/api/photos/)')
  )
);
