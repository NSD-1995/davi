import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}
  async workspaces(schoolId: string | null, academicYearId: string) {
    await this.scope(schoolId, academicYearId);
    const today = this.today();
    const classes = await this.prisma.schoolClass.findMany({ where: { schoolId: schoolId!, academicYearId }, include: { sections: true }, orderBy: { createdAt: 'asc' } });
    const sectionIds = classes.flatMap(item => item.sections.map(section => section.id));
    const [enrollments, assignments, attendance] = await Promise.all([
      this.prisma.studentEnrollment.groupBy({ by: ['sectionId'], where: { schoolId: schoolId!, academicYearId, sectionId: { in: sectionIds }, status: 'ACTIVE' }, _count: { _all: true } }),
      this.prisma.teacherAcademicAssignment.findMany({ where: { schoolId: schoolId!, academicYearId, sectionId: { in: sectionIds } }, select: { sectionId: true, isClassTeacher: true } }),
      this.prisma.studentAttendance.groupBy({ by: ['enrollmentId', 'status'], where: { schoolId: schoolId!, date: today }, _count: { _all: true } }),
    ]);
    const enrollmentBySection = new Map(enrollments.map(item => [item.sectionId, item._count._all]));
    const enrollmentRows = await this.prisma.studentEnrollment.findMany({ where: { schoolId: schoolId!, academicYearId, sectionId: { in: sectionIds }, status: 'ACTIVE' }, select: { id: true, sectionId: true } });
    const sectionByEnrollment = new Map(enrollmentRows.map(item => [item.id, item.sectionId]));
    const attendanceBySection = new Map<string, Record<string, number>>();
    for (const row of attendance) { const section = sectionByEnrollment.get(row.enrollmentId); if (section) { const current = attendanceBySection.get(section) ?? {}; current[row.status] = (current[row.status] ?? 0) + row._count._all; attendanceBySection.set(section, current); } }
    const assignmentBySection = new Map<string, { classTeacher: number; subjectTeachers: number }>();
    for (const assignment of assignments) if (assignment.sectionId) { const current = assignmentBySection.get(assignment.sectionId) ?? { classTeacher: 0, subjectTeachers: 0 }; assignment.isClassTeacher ? current.classTeacher++ : current.subjectTeachers++; assignmentBySection.set(assignment.sectionId, current); }
    return classes.map(item => { const sections = item.sections.map(section => { const total = enrollmentBySection.get(section.id) ?? 0; const marked = attendanceBySection.get(section.id) ?? {}; const attendanceTotal = Object.values(marked).reduce((sum, value) => sum + value, 0); const assignment = assignmentBySection.get(section.id) ?? { classTeacher: 0, subjectTeachers: 0 }; return { id: section.id, name: section.name, studentCount: total, classTeacher: assignment.classTeacher ? true : null, subjectTeacherCount: assignment.subjectTeachers, todayAttendance: { present: marked.PRESENT ?? 0, absent: marked.ABSENT ?? 0, late: marked.LATE ?? 0, notMarked: Math.max(0, total - attendanceTotal) } }; }); return { id: item.id, name: item.name, sectionCount: sections.length, studentCount: sections.reduce((sum, section) => sum + section.studentCount, 0), classTeacherAssignedCount: sections.filter(section => section.classTeacher).length, classTeacherMissingCount: sections.filter(section => !section.classTeacher).length, sections }; });
  }
  async dashboard(schoolId: string | null, academicYearId: string, classId: string, sectionId: string) {
    const scoped = await this.scope(schoolId, academicYearId, classId, sectionId); const today = this.today();
    const [enrollments, teacherAssignments, attendance, subjects, exams, events] = await Promise.all([
      this.prisma.studentEnrollment.findMany({
        where: { schoolId: schoolId!, academicYearId, classId, sectionId, status: 'ACTIVE' },
        include: {
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
              studentParents: {
                include: {
                  parent: {
                    include: {
                      user: { select: { firstName: true, lastName: true, phone: true, email: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.teacherAcademicAssignment.findMany({ where: { schoolId: schoolId!, academicYearId, classId, sectionId }, include: { teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }, subject: true } }),
      this.prisma.studentAttendance.findMany({ where: { schoolId: schoolId!, date: today, enrollment: { academicYearId, classId, sectionId, status: 'ACTIVE' } }, select: { status: true } }),
      this.prisma.classSubject.findMany({ where: { schoolId: schoolId!, academicYearId, classId }, include: { subject: true } }),
      this.prisma.exam.findMany({ where: { schoolId: schoolId!, academicYearId, startDate: { gte: today } }, orderBy: { startDate: 'asc' }, take: 5 }),
      this.prisma.schoolEvent.findMany({ where: { schoolId: schoolId!, startsAt: { gte: today }, status: 'ACTIVE' }, orderBy: { startsAt: 'asc' }, take: 5 }),
    ]);
    const counts = attendance.reduce<Record<string, number>>((result, row) => { result[row.status] = (result[row.status] ?? 0) + 1; return result; }, {}); const marked = attendance.length; const total = enrollments.length;
    const classTeacher = teacherAssignments.find(item => item.isClassTeacher) ?? null;
    return { academicYear: { id: scoped.year.id, name: scoped.year.name, status: scoped.year.status }, class: { id: scoped.schoolClass!.id, name: scoped.schoolClass!.name }, section: { id: scoped.section!.id, name: scoped.section!.name }, classTeacher, summary: { totalStudents: total, presentToday: counts.PRESENT ?? 0, absentToday: counts.ABSENT ?? 0, lateToday: counts.LATE ?? 0, onDutyToday: counts.ON_DUTY ?? 0, excusedToday: counts.EXCUSED ?? 0, notMarkedToday: Math.max(0, total - marked), attendancePercentage: total ? Math.round(((counts.PRESENT ?? 0) / total) * 10000) / 100 : 0 }, subjectTeachers: teacherAssignments.filter(item => !item.isClassTeacher), subjects: subjects.map(item => item.subject), upcomingExams: exams, upcomingEvents: events, students: enrollments, recentStudents: enrollments };
  }
  async students(schoolId: string | null, academicYearId: string, classId: string, sectionId: string) { await this.scope(schoolId, academicYearId, classId, sectionId); return this.prisma.studentEnrollment.findMany({ where: { schoolId: schoolId!, academicYearId, classId, sectionId }, include: { student: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' } }); }
  private async scope(schoolId: string | null, academicYearId: string, classId?: string, sectionId?: string) { if (!schoolId) throw new ForbiddenException('A school account is required.'); const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } }); if (!year) throw new NotFoundException('Academic year not found for your school.'); let schoolClass; let section; if (classId) { schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: classId, schoolId, academicYearId } }); if (!schoolClass) throw new BadRequestException('Class must belong to the selected academic year.'); } if (sectionId) { section = await this.prisma.section.findFirst({ where: { id: sectionId, schoolId, classId } }); if (!section) throw new BadRequestException('Section must belong to the selected class.'); } return { year, schoolClass, section }; }
  private today() { const now = new Date(); return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())); }
}
