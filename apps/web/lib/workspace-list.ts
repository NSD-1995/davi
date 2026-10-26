import type { ClassWorkspace, WorkspaceSection } from './types';

export function filterWorkspaceClasses(rows: ClassWorkspace[], search: string): ClassWorkspace[] {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return rows;
  return rows.map(item => {
    const classText = [item.name, item.code].filter(Boolean).join(' ').toLocaleLowerCase();
    const sections = item.sections.filter(section => {
      const teacher = section.classTeacherDetails;
      const text = [classText, section.name, section.room, teacher?.firstName, teacher?.lastName, teacher?.teacherCode].filter(Boolean).join(' ').toLocaleLowerCase();
      return terms.every(term => text.includes(term));
    });
    return { ...item, sections };
  }).filter(item => item.sections.length > 0 || (item.sectionCount === 0 && terms.every(term => [item.name, item.code].filter(Boolean).join(' ').toLocaleLowerCase().includes(term))));
}

export function workspaceAttendance(section: WorkspaceSection) {
  const total = section.studentCount;
  const attendance = section.todayAttendance;
  if (total === 0) return { label: 'No students', tone: 'neutral', detail: 'No enrolled students', recorded: 0 };
  if (!attendance || !Number.isFinite(attendance.notMarked)) return { label: 'Not marked', tone: 'pending', detail: 'No attendance recorded today', recorded: 0 };
  const recorded = Math.max(0, Math.min(total, total - attendance.notMarked));
  if (recorded === 0) return { label: 'Not marked', tone: 'pending', detail: 'No attendance recorded today', recorded };
  return {
    label: recorded < total ? 'Partially marked' : 'Marked',
    tone: recorded < total ? 'partial' : 'complete',
    detail: `${recorded} of ${total} recorded`,
    recorded,
  };
}

export function sectionWorkspaceHref(classId: string, sectionId: string, academicYearId: string) {
  return `/academics/workspace/${encodeURIComponent(classId)}/sections/${encodeURIComponent(sectionId)}?${new URLSearchParams({ year: academicYearId })}`;
}
