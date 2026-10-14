-- Enforce the rule for concurrent assignments as well as API validation.
-- Existing duplicate active assignments must be resolved before this migration is applied.
CREATE UNIQUE INDEX "TeacherAcademicAssignment_active_class_teacher_teacher_key"
ON "TeacherAcademicAssignment" ("schoolId", "academicYearId", "teacherId")
WHERE "isClassTeacher" = true AND "isActive" = true;
