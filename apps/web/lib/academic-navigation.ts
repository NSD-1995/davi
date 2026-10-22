export interface AcademicLink { href: string; label: string; permission: string; advanced?: boolean }
export interface AcademicDestination { label: string; icon: 'workspace' | 'planning' | 'timetable' | 'setup'; links: AcademicLink[] }
export const academicNavigation: AcademicDestination[] = [
  { label: 'Academic Setup', icon: 'setup', links: [
    { href: '/academics/academic-years', label: 'Academic Years', permission: 'ACADEMIC_YEAR_VIEW' },
    { href: '/academics/classes', label: 'Classes & Sections', permission: 'CLASS_VIEW' },
    { href: '/academics/section-capacity', label: 'Section Capacity & Allocation', permission: 'STUDENT_VIEW' },
    { href: '/academics/groups', label: 'Academic Groups', permission: 'TIMETABLE_VIEW' },
    { href: '/academics/holidays-events', label: 'Holidays & Important Events', permission: 'EVENT_VIEW' },
    { href: '/academics/assessments', label: 'Assessment Setup', permission: 'ASSESSMENT_CONFIGURE' },
    { href: '/academics/subjects', label: 'Subjects', permission: 'SUBJECT_VIEW' },
    { href: '/people/teachers', label: 'Teaching Staff', permission: 'STAFF_VIEW' },
  ] },
  { label: 'Class Workspace', icon: 'workspace', links: [{ href: '/academics/workspace', label: 'Class Workspace', permission: 'CLASS_VIEW' }] },
  { label: 'Timetables', icon: 'timetable', links: [
    { href: '/academics/timetables', label: 'Timetables', permission: 'TIMETABLE_VIEW' },
    { href: '/academics/timetable-settings', label: 'Timetable Settings', permission: 'TIMETABLE_VIEW', advanced: true },
    { href: '/academics/period-templates', label: 'Period Templates', permission: 'PERIOD_TEMPLATE_VIEW', advanced: true },
  ] },
  { label: 'Academic Planning', icon: 'planning', links: [
    { href: '/academics/academic-planner', label: 'Academic Planner', permission: 'LESSON_PLAN_VIEW' },
    { href: '/academics/ai-lesson-plans', label: 'Syllabus & AI Plans', permission: 'LESSON_PLAN_VIEW' },
  ] },
];
export const matchesAcademicRoute = (path: string, href: string) => path === href || path.startsWith(href + '/');
export function visibleAcademicNavigation(can: (permission: string) => boolean) {
  return academicNavigation.map(group => ({ ...group, links: group.links.filter(link => can(link.permission)) })).filter(group => group.links.length);
}
