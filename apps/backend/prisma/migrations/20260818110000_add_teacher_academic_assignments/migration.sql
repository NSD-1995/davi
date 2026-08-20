CREATE TABLE "TeacherAcademicAssignment" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "teacherId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL, "classId" TEXT NOT NULL, "sectionId" TEXT,
  "subjectId" TEXT, "isClassTeacher" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAcademicAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeacherAcademicAssignment_schoolId_academicYearId_teacherId_idx" ON "TeacherAcademicAssignment"("schoolId", "academicYearId", "teacherId");
CREATE INDEX "TeacherAcademicAssignment_classId_sectionId_subjectId_idx" ON "TeacherAcademicAssignment"("classId", "sectionId", "subjectId");
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
