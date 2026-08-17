UPDATE "Subject" SET "type" = UPPER("type") WHERE "type" IS NOT NULL;
UPDATE "Subject" SET "code" = CONCAT('LEGACY-', SUBSTRING("id", 1, 8)) WHERE "code" IS NULL OR BTRIM("code") = '';
UPDATE "Subject" SET "code" = UPPER(BTRIM("code"));
WITH duplicate_codes AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "schoolId", "code" ORDER BY "createdAt", "id") AS position
  FROM "Subject"
)
UPDATE "Subject" AS subject
SET "code" = CONCAT(subject."code", '-', SUBSTRING(subject."id", 1, 8))
FROM duplicate_codes
WHERE subject."id" = duplicate_codes."id" AND duplicate_codes.position > 1;
ALTER TABLE "Subject" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Subject_schoolId_code_key" ON "Subject"("schoolId", "code");

CREATE TABLE "AcademicYearSubject" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicYearSubject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicYearSubject_academicYearId_subjectId_key" ON "AcademicYearSubject"("academicYearId", "subjectId");
CREATE INDEX "AcademicYearSubject_schoolId_idx" ON "AcademicYearSubject"("schoolId");
CREATE INDEX "AcademicYearSubject_subjectId_idx" ON "AcademicYearSubject"("subjectId");
ALTER TABLE "AcademicYearSubject" ADD CONSTRAINT "AcademicYearSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicYearSubject" ADD CONSTRAINT "AcademicYearSubject_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicYearSubject" ADD CONSTRAINT "AcademicYearSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
