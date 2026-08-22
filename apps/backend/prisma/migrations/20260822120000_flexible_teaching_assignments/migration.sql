ALTER TABLE "TeacherAcademicAssignment"
ADD COLUMN "responsibilityType" TEXT NOT NULL DEFAULT 'SUBJECT_TEACHER',
ADD COLUMN "assignmentRole" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "endDate" TIMESTAMP(3);

UPDATE "TeacherAcademicAssignment"
SET "responsibilityType" = CASE WHEN "isClassTeacher" THEN 'LEAD_TEACHER' ELSE 'SUBJECT_TEACHER' END,
    "assignmentRole" = CASE WHEN "subjectId" IS NOT NULL THEN 'PRIMARY' ELSE NULL END;

CREATE INDEX "TeacherAcademicAssignment_schoolId_academicYearId_classId_sectionId_isActive_idx"
ON "TeacherAcademicAssignment"("schoolId", "academicYearId", "classId", "sectionId", "isActive");
CREATE INDEX "TeacherAcademicAssignment_teacherId_academicYearId_isActive_idx"
ON "TeacherAcademicAssignment"("teacherId", "academicYearId", "isActive");
