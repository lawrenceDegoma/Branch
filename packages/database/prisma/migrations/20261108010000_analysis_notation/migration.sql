-- AlterTable
ALTER TABLE "analysis_result" ADD COLUMN     "bound" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notation" TEXT;


-- Estimates now name several sizes (O(n·m + k log k)), so they can be longer; the notation
-- explains the letters. Every CHECK handles NULL explicitly.
ALTER TABLE "analysis_result" DROP CONSTRAINT "analysis_result_sizes";
ALTER TABLE "analysis_result"
  ADD CONSTRAINT "analysis_result_sizes" CHECK (
    char_length("analyzerVersion") BETWEEN 1 AND 40
    AND ("time" IS NULL OR char_length("time") <= 120)
    AND ("space" IS NULL OR char_length("space") <= 120)
    AND ("message" IS NULL OR char_length("message") <= 500)
    AND ("notation" IS NULL OR char_length("notation") <= 1000)
    AND cardinality("reasons") <= 20
    AND cardinality("limitations") <= 20
  );
