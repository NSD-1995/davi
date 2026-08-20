DROP INDEX IF EXISTS "Teacher_teacherCode_key";
CREATE UNIQUE INDEX "Teacher_schoolId_teacherCode_key" ON "Teacher"("schoolId", "teacherCode");
