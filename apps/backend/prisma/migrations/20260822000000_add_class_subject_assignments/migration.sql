CREATE TABLE "ClassSubject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassSubject_academicYearId_classId_subjectId_key" ON "ClassSubject"("academicYearId", "classId", "subjectId");
CREATE INDEX "ClassSubject_schoolId_academicYearId_classId_idx" ON "ClassSubject"("schoolId", "academicYearId", "classId");
CREATE INDEX "ClassSubject_subjectId_idx" ON "ClassSubject"("subjectId");

ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the previous academic-year-wide choices by applying them to every
-- existing class in that year. Administrators can then refine each class.
INSERT INTO "ClassSubject" ("id", "schoolId", "academicYearId", "classId", "subjectId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, ays."schoolId", ays."academicYearId", c."id", ays."subjectId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "AcademicYearSubject" ays
JOIN "SchoolClass" c ON c."academicYearId" = ays."academicYearId" AND c."schoolId" = ays."schoolId"
ON CONFLICT ("academicYearId", "classId", "subjectId") DO NOTHING;
