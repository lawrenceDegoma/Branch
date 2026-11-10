-- CreateTable
CREATE TABLE "rate_limit_bucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_bucket_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateTable
CREATE TABLE "server_error" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT,
    "digest" TEXT,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "routeType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,

    CONSTRAINT "server_error_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_bucket_windowStart_idx" ON "rate_limit_bucket"("windowStart");

-- CreateIndex
CREATE INDEX "server_error_at_idx" ON "server_error"("at");

-- CreateIndex
CREATE INDEX "server_error_digest_idx" ON "server_error"("digest");


-- Only what's needed to find a bug, never request contents; bounded so a row stays small.
ALTER TABLE "server_error" ADD CONSTRAINT "server_error_lengths" CHECK (
  char_length("path") <= 500 AND char_length("method") <= 10 AND char_length("routeType") <= 20
  AND char_length("name") <= 200 AND char_length("message") <= 2000
  AND ("stack" IS NULL OR char_length("stack") <= 4000)
  AND ("requestId" IS NULL OR char_length("requestId") <= 100)
  AND ("digest" IS NULL OR char_length("digest") <= 100)
);
ALTER TABLE "rate_limit_bucket" ADD CONSTRAINT "rate_limit_bucket_key" CHECK (char_length("key") <= 200);
