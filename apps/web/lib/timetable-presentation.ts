import { academicGroup } from './academic-groups';

export const timetableDayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function timetableDays(plan: any): number[] {
  const configured = plan.template?.workingDays;
  return Array.isArray(configured) ? configured : [...new Set<number>((plan.entries || []).map((entry: any) => entry.weekday))].sort((a, b) => a - b);
}
export function timetableSlots(plan: any): any[] {
  return [...(plan.template?.slots || [])].sort((a, b) => a.sequence - b.sequence);
}
export function timetableCell(plan: any, slot: any, weekday: number) {
  if (Array.isArray(slot.applicableDays) && !slot.applicableDays.includes(weekday)) return { kind: 'inactive', subject: 'Not scheduled', teacher: '', room: '', conflict: '' };
  const teaching = ['TEACHING', 'SUBJECT'].includes(slot.type);
  const entry = (teaching ? plan.entries || [] : plan.supervisionEntries || []).find((item: any) => item.weekday === weekday && item.periodSlotId === slot.id);
  const teacher = [entry?.teacher?.user?.firstName, entry?.teacher?.user?.lastName].filter(Boolean).join(' ');
  return {
    kind: teaching ? 'lesson' : slot.type === 'ASSEMBLY' ? 'assembly' : 'break',
    subject: teaching ? entry ? entry.subject?.name || 'Subject not recorded' : 'Flexible / free' : slot.name,
    teacher: teaching ? entry ? teacher || 'Teacher not assigned' : '' : teacher || String(slot.type || 'Non-teaching').replace(/_/g, ' ').toLowerCase(),
    room: entry?.room || '', conflict: entry?.conflictCode || '',
  };
}
export function filterTimetableClasses(classes: any[], group: string, classId: string, search: string) {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return classes.filter(c => (!group || academicGroup(c) === group) && (!classId || c.id === classId)).map(c => ({ ...c, sections: c.sections.filter((s: any) => terms.every(term => `${c.name} ${c.code || ''} ${s.name}`.toLowerCase().includes(term))) })).filter(c => c.sections.length || !c.sectionCount && terms.every(term => String(c.name).toLowerCase().includes(term)));
}
export function mergeTimetableIssues(...sources: any[][]): any[] {
  const seen = new Set<string>();
  return sources.flat().filter(issue => { const key = JSON.stringify([issue.code, issue.message, issue.weekday, issue.periodSlotId, issue.teacherId]); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function timetableCSV(sections: { label: string; plan: any }[]) {
  const quote = (value: unknown) => { let text = String(value ?? ''); if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
  const rows: unknown[][] = [['Section', 'Version', 'Status', 'Day', 'Period', 'Start', 'End', 'Type', 'Subject / activity', 'Teacher / supervision', 'Room']];
  for (const { label, plan } of sections) for (const day of timetableDays(plan)) for (const slot of timetableSlots(plan)) {
    const cell = timetableCell(plan, slot, day);
    rows.push([label, plan.version, plan.status, timetableDayNames[day], slot.name, slot.startTime, slot.endTime, slot.type, cell.subject, cell.teacher, cell.room]);
  }
  return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
}
