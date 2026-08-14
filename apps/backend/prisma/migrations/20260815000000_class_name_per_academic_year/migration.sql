-- Allow a class name (for example, "1st Standard") to be reused in a later academic year.
DROP INDEX "SchoolClass_schoolId_name_key";

CREATE UNIQUE INDEX "SchoolClass_schoolId_academicYearId_name_key"
ON "SchoolClass"("schoolId", "academicYearId", "name");
