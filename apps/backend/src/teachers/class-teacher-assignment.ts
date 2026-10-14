import { ConflictException } from '@nestjs/common';

export async function assertClassTeacherAvailable(db: any, schoolId: string, academicYearId: string, teacherId: string, classId: string, sectionId: string | null) {
  const assigned = await db.teacherAcademicAssignment.findFirst({
    where: { schoolId, academicYearId, teacherId, isClassTeacher: true, isActive: true, NOT: { classId, sectionId } },
  });
  if (assigned) throw new ConflictException('This teacher is already assigned as class teacher to another class or section in this academic year. Remove that assignment first.');
}
