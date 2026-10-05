-- AlterTable
ALTER TABLE "ParentSchoolMembership" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "TeacherAcademicAssignment_schoolId_academicYearId_classId_secti" RENAME TO "TeacherAcademicAssignment_schoolId_academicYearId_classId_s_idx";
