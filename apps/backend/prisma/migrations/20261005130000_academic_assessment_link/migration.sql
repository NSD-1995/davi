ALTER TABLE "AcademicPaper" ADD COLUMN "examSubjectId" TEXT;
CREATE UNIQUE INDEX "AcademicPaper_examSubjectId_key" ON "AcademicPaper"("examSubjectId");
