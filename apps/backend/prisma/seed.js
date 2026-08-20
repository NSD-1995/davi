const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const codes = [
  'DASHBOARD_VIEW', 'SCHOOL_PROFILE_VIEW', 'SCHOOL_PROFILE_UPDATE',
  'ACADEMIC_YEAR_VIEW', 'ACADEMIC_YEAR_CREATE', 'ACADEMIC_YEAR_UPDATE',
  'CLASS_VIEW', 'CLASS_CREATE', 'CLASS_UPDATE', 'CLASS_DELETE',
  'SECTION_VIEW', 'SECTION_CREATE', 'SECTION_UPDATE', 'SECTION_DELETE',
  'SUBJECT_VIEW', 'SUBJECT_CREATE', 'SUBJECT_UPDATE', 'SUBJECT_DELETE',
  'STAFF_VIEW', 'STAFF_CREATE', 'STAFF_UPDATE', 'STAFF_DELETE',
  'ROLE_VIEW', 'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE', 'ROLE_PERMISSION_MANAGE',
  'STUDENT_VIEW', 'STUDENT_CREATE', 'STUDENT_UPDATE', 'STUDENT_DELETE',
  'PARENT_VIEW', 'PARENT_CREATE', 'PARENT_UPDATE',
  'TIMETABLE_VIEW', 'TIMETABLE_MANAGE', 'ATTENDANCE_VIEW', 'ATTENDANCE_MARK',
  'ATTENDANCE_UPDATE', 'EXAM_VIEW', 'EXAM_CREATE', 'EXAM_UPDATE',
  'MARKS_VIEW', 'MARKS_UPDATE', 'REPORT_VIEW',
  'EVENT_VIEW', 'EVENT_MANAGE', 'NOTIFICATION_VIEW', 'NOTIFICATION_MANAGE', 'AUDIT_VIEW',
];

async function main() {
  for (const code of codes) {
    const separator = code.lastIndexOf('_');
    await prisma.permission.upsert({
      where: { code }, update: {},
      create: { code, module: code.slice(0, separator), action: code.slice(separator + 1), description: code.toLowerCase().replaceAll('_', ' ') },
    });
  }
}

main().finally(() => prisma.$disconnect());
