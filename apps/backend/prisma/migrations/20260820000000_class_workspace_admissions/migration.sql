CREATE UNIQUE INDEX "TeacherAcademicAssignment_one_class_teacher_per_section_year"
ON "TeacherAcademicAssignment"("schoolId", "academicYearId", "sectionId")
WHERE "isClassTeacher" = true;

CREATE UNIQUE INDEX "Student_schoolId_admissionNumber_key"
ON "Student"("schoolId", "admissionNumber");
