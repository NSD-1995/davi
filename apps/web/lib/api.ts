import type { AcademicYear, ClassWorkspace, DashboardSummary, Permission, Role, School, SchoolClass, Section, SectionDashboard, Staff, Student, Subject, User } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
export class ApiError extends Error { constructor(message: string, public status: number, public details?: unknown) { super(message); } }
let unauthorizedHandler: (() => void) | undefined;
export function onUnauthorized(handler: () => void) { unauthorizedHandler = handler; return () => { if (unauthorizedHandler === handler) unauthorizedHandler = undefined; }; }
function messageOf(body: unknown) { if (body && typeof body === 'object' && 'message' in body) { const value = (body as { message: unknown }).message; return Array.isArray(value) ? value.join(', ') : String(value); } return 'Something went wrong. Please try again.'; }
async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) { if (response.status === 401) unauthorizedHandler?.(); throw new ApiError(messageOf(body), response.status, body); }
  return body as T;
}
const json = (value: unknown) => JSON.stringify(value);
export const authApi = {
  login: (identifier: string, password: string) => request<{ token: string; requiresPasswordChange: boolean; user: User }>('/auth/login', { method: 'POST', body: json({ username: identifier, password }) }),
  me: (token: string) => request<{ user: User; roles: Array<{ id: string; name: string; code: string }>; permissions: string[] }>('/auth/me', {}, token),
  changePassword: (token: string, currentPassword: string, newPassword: string) => request<{ message: string; user: User }>('/auth/change-password', { method: 'POST', body: json({ currentPassword, newPassword }) }, token),
};
export const dashboardApi = { summary: (t: string) => request<DashboardSummary>('/dashboard/summary', {}, t) };
export const schoolSettingsApi = {
  get: (t: string, schoolId: string) => request<Record<string, unknown>>(`/school-settings/schools/${schoolId}`, {}, t),
  save: (t: string, schoolId: string, data: Record<string, unknown>) => request<Record<string, unknown>>('/school-settings', { method: 'POST', body: json({ schoolId, ...data }) }, t),
  update: (t: string, id: string, data: Record<string, unknown>) => request<Record<string, unknown>>(`/school-settings/${id}`, { method: 'PATCH', body: json(data) }, t),
};
export const timetableApi = { list: (t: string, yearId: string, classId: string, sectionId: string) => request<Record<string, unknown>[]>(`/timetable/entries?academicYearId=${yearId}&classId=${classId}&sectionId=${sectionId}`, {}, t) };
export const attendanceApi = {
  list: (t:string,classId:string,sectionId:string,from:string,to:string) => request<Array<{id:string;enrollmentId:string;date:string;status:string;remarks?:string|null}>>(`/attendance/students?classId=${classId}&sectionId=${sectionId}&from=${from}&to=${to}`,{},t),
  mark: (t:string,date:string,records:Array<{enrollmentId:string;status:string;remarks?:string}>) => request('/attendance/students',{method:'POST',body:json({date,records})},t),
};
export const examApi = { list: (t: string, yearId: string) => request<Record<string, unknown>[]>(`/exams?academicYearId=${yearId}`, {}, t), results: (t: string, examId: string, classId: string) => request<Record<string, unknown>[]>(`/exams/${examId}/results?classId=${classId}`, {}, t) };
export const eventApi = { list: (t: string) => request<Record<string, unknown>[]>('/events', {}, t) };
export const reportApi = { students: (t: string, yearId: string, classId: string) => request<Record<string, unknown>[]>(`/reports/students?academicYearId=${yearId}&classId=${classId}`, {}, t) };
export const schoolApi = {
  // Login is currently the only School Admin-readable source for the school record.
  update: (t: string, id: string, data: Partial<School>) => request<School>(`/schools/${id}`, { method: 'PATCH', body: json(data) }, t),
};
export const academicYearApi = {
  list: (t: string) => request<AcademicYear[]>('/academic-years', {}, t),
  create: (t: string, data: Partial<AcademicYear>) => request<AcademicYear>('/academic-years', { method: 'POST', body: json(data) }, t),
  update: (t: string, id: string, data: Partial<AcademicYear>) => request<AcademicYear>(`/academic-years/${id}`, { method: 'PATCH', body: json(data) }, t),
  assignedSubjects: (t: string, id: string) => request<{ subjects: Subject[] }>(`/academic-years/${id}/subjects`, {}, t),
  assignSubjects: (t: string, id: string, schoolId: string, subjectIds: string[]) => request<Subject[]>(`/academic-years/${id}/subjects`, { method: 'POST', body: json({ schoolId, subjectIds }) }, t),
  removeSubject: (t: string, id: string, subjectId: string) => request(`/academic-years/${id}/subjects/${subjectId}`, { method: 'DELETE' }, t),
};
export const classApi = {
  list: (t: string) => request<SchoolClass[]>('/classes', {}, t),
  create: (t: string, data: Record<string, unknown>) => request<SchoolClass>('/classes', { method: 'POST', body: json(data) }, t),
  update: (t: string, id: string, data: Record<string, unknown>) => request<SchoolClass>(`/classes/${id}`, { method: 'PATCH', body: json(data) }, t),
  bulk: (t: string, data: Record<string, unknown>) => request('/classes/bulk', { method: 'POST', body: json(data) }, t),
  assignedSubjects: (t: string, yearId: string, classId: string) => request<{ academicYearId: string; classId: string; subjects: Subject[] }>(`/academic-years/${yearId}/classes/${classId}/subjects`, {}, t),
  availableSubjects: (t: string, yearId: string, classId: string) => request<Array<Subject & { isAssigned: boolean }>>(`/academic-years/${yearId}/classes/${classId}/available-subjects`, {}, t),
  replaceSubjects: (t: string, yearId: string, classId: string, subjectIds: string[]) => request<{ academicYearId: string; classId: string; subjects: Subject[] }>(`/academic-years/${yearId}/classes/${classId}/subjects`, { method: 'PUT', body: json({ subjectIds }) }, t),
};
export const classWorkspaceApi = {
  list: (t: string, yearId: string) => request<ClassWorkspace[]>(`/academic-years/${yearId}/class-workspaces`, {}, t),
  dashboard: (t: string, yearId: string, classId: string, sectionId: string) => request<SectionDashboard>(`/academic-years/${yearId}/classes/${classId}/sections/${sectionId}/dashboard`, { cache: 'no-store' }, t),
  students: (t: string, yearId: string, classId: string, sectionId: string) => request<SectionDashboard['recentStudents']>(`/academic-years/${yearId}/classes/${classId}/sections/${sectionId}/students`, {}, t),
  classTeacher: (t: string, yearId: string, classId: string, sectionId: string, teacherId: string) => request(`/academic-years/${yearId}/classes/${classId}/sections/${sectionId}/class-teacher`, { method: 'PUT', body: json({ teacherId }) }, t),
  admit: (t: string, data: Record<string, unknown>) => request('/student-admissions', { method: 'POST', body: json(data) }, t),
  teachingTeam: (t:string,y:string,c:string,s:string) => request<{members:Array<Record<string,unknown>>}>(`/academic-years/${y}/classes/${c}/sections/${s}/teaching-team`,{},t),
  saveTeachingTeam: (t:string,y:string,c:string,s:string,members:Array<{staffId:string;responsibilityType:string}>) => request(`/academic-years/${y}/classes/${c}/sections/${s}/teaching-team`,{method:'PUT',body:json({members})},t),
  subjectTeachers: (t:string,y:string,c:string,s:string) => request<{assignments:Array<Record<string,unknown>>}>(`/academic-years/${y}/classes/${c}/sections/${s}/subject-teachers`,{},t),
  saveSubjectTeachers: (t:string,y:string,c:string,s:string,assignments:Array<{subjectId:string;staffId:string;assignmentRole:string}>) => request(`/academic-years/${y}/classes/${c}/sections/${s}/subject-teachers`,{method:'PUT',body:json({assignments})},t),
  workload: (t:string,y:string,staffId:string) => request<Record<string,number|string>>(`/academic-years/${y}/staff/${staffId}/workload`,{},t),
};
export const sectionApi = {
  create: (t: string, data: Record<string, unknown>) => request<Section>('/sections', { method: 'POST', body: json(data) }, t),
  update: (t: string, id: string, data: Record<string, unknown>) => request<Section>(`/sections/${id}`, { method: 'PATCH', body: json(data) }, t),
};
export const subjectApi = {
  list: (t: string) => request<Subject[]>('/subjects', {}, t),
  create: (t: string, data: Record<string, unknown>) => request<Subject>('/subjects', { method: 'POST', body: json(data) }, t),
  update: (t: string, id: string, data: Record<string, unknown>) => request<Subject>(`/subjects/${id}`, { method: 'PATCH', body: json(data) }, t),
  remove: (t: string, id: string) => request(`/subjects/${id}`, { method: 'DELETE' }, t),
};
export const roleApi = {
  list: (t: string, s: string) => request<Role[]>(`/schools/${s}/roles`, {}, t),
  create: (t: string, s: string, data: Record<string, unknown>) => request<Role>(`/schools/${s}/roles`, { method: 'POST', body: json(data) }, t),
  update: (t: string, s: string, id: string, data: Record<string, unknown>) => request<Role>(`/schools/${s}/roles/${id}`, { method: 'PATCH', body: json(data) }, t),
  remove: (t: string, s: string, id: string) => request(`/schools/${s}/roles/${id}`, { method: 'DELETE' }, t),
  permissions: (t: string, s: string, id: string) => request<{ permissions: Permission[] }>(`/schools/${s}/roles/${id}/permissions`, {}, t),
  savePermissions: (t: string, s: string, id: string, permissionIds: string[]) => request(`/schools/${s}/roles/${id}/permissions`, { method: 'PUT', body: json({ permissionIds }) }, t),
};
export const permissionApi = { list: (t: string) => request<Permission[]>('/permissions', {}, t) };
export const staffApi = {
  list: (t: string, s: string) => request<Staff[]>(`/schools/${s}/staff`, {}, t),
  create: (t: string, s: string, data: Record<string, unknown>) => request<{ message: string; staff: Staff; credentials: { username: string; temporaryPassword: string } }>(`/schools/${s}/staff`, { method: 'POST', body: json(data) }, t),
  update: (t: string, s: string, id: string, data: Record<string, unknown>) => request<Staff>(`/schools/${s}/staff/${id}`, { method: 'PATCH', body: json(data) }, t),
  deactivate: (t: string, s: string, id: string) => request(`/schools/${s}/staff/${id}`, { method: 'DELETE' }, t),
};
export const teacherApi = { list: (t: string) => request<Array<{ id: string; userId: string; teacherCode: string; specialization?: string | null; qualification?: string | null; status: string; user: { firstName: string; lastName: string } }>>('/teachers', {}, t), create: (t: string, data: Record<string, unknown>) => request('/teachers', { method: 'POST', body: json(data) }, t), update: (t: string, id: string, data: Record<string, unknown>) => request(`/teachers/${id}`, { method: 'PATCH', body: json(data) }, t), remove: (t: string, id: string) => request(`/teachers/${id}`, { method: 'DELETE' }, t) };
export const parentApi = { list: (t: string) => request<Array<{ id: string; parentCode: string; occupation?: string | null; status: string; user: { firstName: string; lastName: string; phone?: string | null; email?: string | null } }>>('/parents', {}, t), onboard: (t: string, data: Record<string, unknown>) => request<{ parent: Record<string, unknown>; credentials: { username: string; temporaryPassword: string } }>('/parents/onboard', { method: 'POST', body: json(data) }, t), update: (t: string, id: string, data: Record<string, unknown>) => request(`/parents/${id}`, { method: 'PATCH', body: json(data) }, t), remove: (t: string, id: string) => request(`/parents/${id}`, { method: 'DELETE' }, t) };
export const studentApi = {
  list: (t: string) => request<Student[]>('/students', {}, t),
  update: (t: string, id: string, data: Record<string, unknown>) => request<Student>(`/students/${id}`, { method: 'PATCH', body: json(data) }, t),
  remove: (t: string, id: string) => request(`/students/${id}`, { method: 'DELETE' }, t),
};
