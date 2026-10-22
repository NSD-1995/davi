-- DropIndex
DROP INDEX "Exam_academicYearId_name_key";

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "assessmentSectionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Exam_academicYearId_name_assessmentSectionId_key" ON "Exam"("academicYearId", "name", "assessmentSectionId");
CREATE UNIQUE INDEX "Exam_legacy_year_name_key" ON "Exam"("academicYearId","name") WHERE "assessmentPatternId" IS NULL;
