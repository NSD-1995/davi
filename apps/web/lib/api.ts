import {attendanceLocation} from './attendance-location';
import type { AcademicYear, ClassWorkspace, CreateSchoolResult, DashboardSummary, MyDashboard, Parent, Permission, Role, School, SchoolClass, Section, SectionDashboard, Staff, Student, Subject, User } from './types';

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
const admissionQuery = (query: Record<string, unknown>) => new URLSearchParams(Object.entries(query).filter(([,value]) => value !== '' && value !== null && value !== undefined).map(([key,value]) => [key,String(value)])).toString();
export const admissionsApi = {
  lookups: (t: string) => request<any>('/admissions/lookups', {}, t),
  list: (t: string, kind: string, query: Record<string, unknown>) => request<any>(`/admissions/${kind}?${admissionQuery(query)}`, {}, t),
  detail: (t: string, kind: string, id: string) => request<any>(`/admissions/${kind}/${id}`, {}, t),
  dashboard: (t: string, query: Record<string, unknown>) => request<any>(`/admissions/dashboard?${admissionQuery(query)}`, {}, t),
  settings: (t: string, body: unknown) => request<any>('/admissions/settings', { method: 'PUT', body: json(body) }, t),
  create: (t: string, kind: string, body: unknown) => request<any>(`/admissions/${kind}`, { method: 'POST', body: json(body) }, t),
  action: (t: string, kind: string, id: string, action: string, body: unknown) => request<any>(`/admissions/${kind}/${id}/${action}`, { method: 'POST', body: json(body) }, t),
  upload: async (t: string, id: string, kind: string, file: File) => {
    const form = new FormData(); form.set('kind', kind); form.set('file', file);
    const response = await fetch(`${API_URL}/admissions/applications/${id}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: form });
    const body = await response.json(); if (!response.ok) throw new ApiError(messageOf(body), response.status, body); return body;
  },
  download: async (t: string, applicationId: string, documentId: string, filename: string) => {
    const response = await fetch(`${API_URL}/admissions/applications/${applicationId}/documents/${documentId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (!response.ok) throw new ApiError(messageOf(await response.json().catch(() => null)), response.status);
    const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  },
};
export const enrollmentPlanningApi = {
  lookups: (t: string) => request<any>('/enrollment-planning/lookups', {}, t),
  list: (t: string, yearId: string, classId: string) => request<any>(`/enrollment-planning?${admissionQuery({ academicYearId: yearId, classId })}`, {}, t),
  action: (t: string, action: string, body: unknown) => request<any>(`/enrollment-planning/${action}`, { method: 'POST', body: json(body) }, t),
  history: (t: string, id: string) => request<any[]>(`/enrollment-planning/${id}/history`, {}, t),
};
export const authApi = {
  login: (identifier: string, password: string, schoolSlug?: string) => request<{ token: string; requiresPasswordChange: boolean; user: User }>('/auth/login', { method: 'POST', body: json({ username: identifier, password, schoolSlug }) }),
  me: (token: string) => request<{ user: User; roles: Array<{ id: string; name: string; code: string }>; permissions: string[] }>('/auth/me', {}, token),
  changePassword: (token: string, currentPassword: string, newPassword: string) => request<{ message: string; user: User }>('/auth/change-password', { method: 'POST', body: json({ currentPassword, newPassword }) }, token),
};
export const dashboardApi = { me: (t:string)=>request<MyDashboard>('/dashboard/me',{},t), summary: (t: string) => request<DashboardSummary>('/dashboard/summary', {}, t) };
export const schoolSettingsApi = {
  get: (t: string, schoolId: string) => request<Record<string, unknown>>(`/school-settings/schools/${schoolId}`, {}, t),
  save: (t: string, data: Record<string, unknown>) => request<Record<string, unknown>>('/school-settings', { method: 'POST', body: json(data) }, t),
  update: (t: string, id: string, data: Record<string, unknown>) => request<Record<string, unknown>>(`/school-settings/${id}`, { method: 'PATCH', body: json(data) }, t),
};
export const timetableApi = { list: (t: string, yearId: string, classId: string, sectionId: string) => request<Record<string, unknown>[]>(`/timetable/entries?academicYearId=${yearId}&classId=${classId}&sectionId=${sectionId}`, {}, t) };
export const periodTemplateApi={remove:(t:string,id:string)=>request(`/period-templates/${id}`,{method:'DELETE'},t),list:(t:string,y:string)=>request<any[]>(`/period-templates?academicYearId=${y}`,{},t),get:(t:string,id:string)=>request<any>(`/period-templates/${id}`,{},t),preview:(t:string,d:any)=>request<any[]>('/period-templates/preview',{method:'POST',body:json(d)},t),create:(t:string,d:any)=>request<any>('/period-templates',{method:'POST',body:json(d)},t),update:(t:string,id:string,d:any)=>request<any>(`/period-templates/${id}`,{method:'PATCH',body:json(d)},t),status:(t:string,id:string,status:string)=>request(`/period-templates/${id}/status`,{method:'POST',body:json({status})},t),version:(t:string,id:string,effectiveFrom:string)=>request(`/period-templates/${id}/version`,{method:'POST',body:json({effectiveFrom})},t),assign:(t:string,id:string,d:any)=>request(`/period-templates/${id}/assignments`,{method:'POST',body:json(d)},t),unassign:(t:string,id:string,a:string)=>request(`/period-templates/${id}/assignments/${a}`,{method:'DELETE'},t),affected:(t:string,id:string)=>request<any>(`/period-templates/${id}/affected-timetables`,{},t),resolve:(t:string,y:string,c:string,s:string,date:string)=>request<any>(`/period-templates/resolve?academicYearId=${y}&classId=${c}&sectionId=${s}&date=${date}`,{},t)};
export const timetablePlanningApi={publishAll:(t:string,d:{academicYearId:string;planIds:string[]})=>request<{publishedPlans:number}>('/timetable-planning/plans/publish-all',{method:'POST',body:json(d)},t),removeAll:(t:string,y:string)=>request<{deletedPlans:number;deletedEntries:number}>(`/timetable-planning/plans?academicYearId=${encodeURIComponent(y)}`,{method:'DELETE'},t),allPlans:(t:string,y:string)=>request<any[]>(`/timetable-planning/plans?academicYearId=${y}`,{},t),remove:(t:string,id:string)=>request(`/timetable-planning/plans/${id}`,{method:'DELETE'},t),requirements:(t:string,y:string,c:string)=>request<any>(`/timetable-planning/requirements?academicYearId=${y}&classId=${c}`,{},t),saveRequirements:(t:string,d:any)=>request('/timetable-planning/requirements',{method:'PUT',body:json(d)},t),generate:(t:string,d:any)=>request<any>('/timetable-planning/generate',{method:'POST',body:json(d)},t),plans:(t:string,y:string,c:string,s:string)=>request<any[]>(`/timetable-planning/plans?academicYearId=${y}&classId=${c}&sectionId=${s}`,{},t),publish:(t:string,id:string)=>request(`/timetable-planning/plans/${id}/publish`,{method:'POST'},t)};
export const attendanceApi = {
  list: (t:string,classId:string,sectionId:string,from:string,to:string) => request<Array<{id:string;enrollmentId:string;date:string;status:string;remarks?:string|null;enrollment?:any}>>(`/attendance/students?classId=${classId}&sectionId=${sectionId}&from=${from}&to=${to}`,{cache: 'no-store'},t),
  mark: (t:string,date:string,records:Array<{enrollmentId:string;status:string;remarks?:string}>) => request('/attendance/students',{method:'POST',body:json({date,records})},t),
};
export const examApi = { list: (t: string, yearId: string) => request<Record<string, unknown>[]>(`/exams?academicYearId=${yearId}`, {}, t), results: (t: string, examId: string, classId: string) => request<Record<string, unknown>[]>(`/exams/${examId}/results?classId=${classId}`, {}, t) };
export const eventApi = { create: (t:string, data:Record<string,unknown>) => request('/events',{method:'POST',body:json(data)},t), list: (t: string) => request<Record<string, unknown>[]>('/events', {}, t) };
export const reportApi = { students: (t: string, yearId: string, classId: string) => request<Record<string, unknown>[]>(`/reports/students?academicYearId=${yearId}&classId=${classId}`, {}, t) };
export const schoolApi = {
  current: (t: string) => request<School>('/schools/me/profile', {}, t),
  updateCurrent: (t: string, data: Partial<School>) => request<School>('/schools/me/profile', { method: 'PATCH', body: json(data) }, t),
  list: (t: string) => request<School[]>('/schools', {}, t),
  create: (t: string, data: Record<string, unknown>) => request<CreateSchoolResult>('/schools', { method: 'POST', body: json(data) }, t),
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
  remove: (t:string,id:string) => request(`/classes/${id}`, {method:'DELETE'}, t),
  list: (t: string) => request<SchoolClass[]>('/classes', {}, t),
  create: (t: string, data: Record<string, unknown>) => request<SchoolClass>('/classes', { method: 'POST', body: json(data) }, t),
  update: (t: string, id: string, data: Record<string, unknown>) => request<SchoolClass>(`/classes/${id}`, { method: 'PATCH', body: json(data) }, t),
  bulk: (t: string, data: Record<string, unknown>) => request('/classes/bulk', { method: 'POST', body: json(data) }, t),
  assignedSubjects: (t: string, yearId: string, classId: string) => request<{ academicYearId: string; classId: string; subjects: Subject[] }>(`/academic-years/${yearId}/classes/${classId}/subjects`, {}, t),
  availableSubjects: (t: string, yearId: string, classId: string) => request<Array<Subject & { isAssigned: boolean }>>(`/academic-years/${yearId}/classes/${classId}/available-subjects`, {}, t),
  replaceSubjects: (t: string, yearId: string, classId: string, subjectIds: string[]) => request<{ academicYearId: string; classId: string; subjects: Subject[] }>(`/academic-years/${yearId}/classes/${classId}/subjects`, { method: 'PUT', body: json({ subjectIds }) }, t),
};
export const classWorkspaceApi = {
 timetableSetup:(t:string,y:string,c:string,s:string)=>request<any>(`/academic-years/${y}/classes/${c}/sections/${s}/timetable-setup`,{},t),
 saveTimetableSetup:(t:string,y:string,c:string,s:string,d:any)=>request<any>(`/academic-years/${y}/classes/${c}/sections/${s}/timetable-setup`,{method:'PUT',body:json(d)},t),
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
const classroomPath=(y:string,c:string,s:string)=>`/academic-years/${y}/classes/${c}/sections/${s}`;
export const classroomManagementApi={
  homework:(t:string,y:string,c:string,s:string)=>request<any[]>(`${classroomPath(y,c,s)}/homework`,{},t),
  createHomework:(t:string,y:string,c:string,s:string,d:any)=>request(`${classroomPath(y,c,s)}/homework`,{method:'POST',body:json(d)},t),
  updateHomework:(t:string,y:string,c:string,s:string,id:string,d:any)=>request(`${classroomPath(y,c,s)}/homework/${id}`,{method:'PATCH',body:json(d)},t),
  lessons:(t:string,y:string,c:string,s:string)=>request<any[]>(`${classroomPath(y,c,s)}/lesson-plans`,{},t),
  createLesson:(t:string,y:string,c:string,s:string,d:any)=>request(`${classroomPath(y,c,s)}/lesson-plans`,{method:'POST',body:json(d)},t),
  updateLesson:(t:string,y:string,c:string,s:string,id:string,d:any)=>request(`${classroomPath(y,c,s)}/lesson-plans/${id}`,{method:'PATCH',body:json(d)},t),
  announcements:(t:string,y:string,c:string,s:string)=>request<any[]>(`${classroomPath(y,c,s)}/announcements`,{},t),
  createAnnouncement:(t:string,y:string,c:string,s:string,d:any)=>request(`${classroomPath(y,c,s)}/announcements`,{method:'POST',body:json(d)},t),
  calendar:(t:string,y:string,c:string,s:string)=>request<any[]>(`${classroomPath(y,c,s)}/calendar`,{},t),
  analysis:(t:string,y:string,c:string,s:string)=>request<any[]>(`${classroomPath(y,c,s)}/analysis`,{},t),
  settings:(t:string,y:string,c:string,s:string)=>request<any>(`${classroomPath(y,c,s)}/settings`,{},t),
  updateSettings:(t:string,y:string,c:string,s:string,d:any)=>request(`${classroomPath(y,c,s)}/settings`,{method:'PATCH',body:json(d)},t),
};
export const sectionApi = {
  rollNumbers:(token:string,sectionId:string,action:'preview'|'generate',body:unknown)=>request<any>(`/sections/${sectionId}/roll-numbers/${action}`,{method:'POST',body:json(body)},token),
  remove: (t:string,id:string) => request(`/sections/${id}`, {method:'DELETE'}, t),
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
interface PermissionGroup { module: string; permissions: Permission[] }
export const permissionApi = {
  list: async (t: string) => {
    const groups = await request<PermissionGroup[]>('/permissions', {}, t);
    return groups.flatMap((group) => group.permissions);
  },
};
export const staffApi = {
 categories:(t:string,s:string)=>request<any[]>('/schools/'+s+'/staff/categories',{},t),
 createCategory:(t:string,s:string,d:any)=>request<any>('/schools/'+s+'/staff/categories',{method:'POST',body:json(d)},t),
  list: (t: string, s: string) => request<Staff[]>(`/schools/${s}/staff`, {}, t),
  create: (t: string, s: string, data: Record<string, unknown>) => request<{ message: string; staff: Staff; credentials: { username: string; temporaryPassword: string } }>(`/schools/${s}/staff`, { method: 'POST', body: json(data) }, t),
  update: (t: string, s: string, id: string, data: Record<string, unknown>) => request<Staff>(`/schools/${s}/staff/${id}`, { method: 'PATCH', body: json(data) }, t),
  deactivate: (t: string, s: string, id: string) => request(`/schools/${s}/staff/${id}`, { method: 'DELETE' }, t),
};
export const teacherApi = { saveTeachingSetup:(t:string,id:string,d:any)=>request<any>(`/teachers/${id}/teaching-setup`,{method:'PUT',body:json(d)},t), saveEligibility:(t:string,id:string,d:any)=>request<any>(`/teachers/${id}/eligibility`,{method:'PUT',body:json(d)},t), saveCapabilities:(t:string,id:string,subjectIds:string[])=>request<any>(`/teachers/${id}/capabilities`,{method:'PUT',body:json({subjectIds})},t), removeSubjectAssignment:(t:string,id:string,assignmentId:string)=>request(`/teachers/${id}/subject-assignments/${assignmentId}`,{method:'DELETE'},t), classTeacherOptions:(t:string,y:string)=>request<any[]>(`/teachers/class-teacher-options?academicYearId=${y}`,{},t), list: (t: string) => request<Array<{ id: string; userId: string; teacherCode: string; specialization?: string | null; qualification?: string | null; capableSubjectIds?:string[]; timetableEligibility?:any; status: string; user: { firstName: string; lastName: string } }>>('/teachers', {}, t), get: (t:string,id:string)=>request<Record<string,any>>(`/teachers/${id}`,{},t), assignments:(t:string,id:string)=>request<Record<string,any>[]>(`/teachers/${id}/assignments`,{},t), create: (t: string, data: Record<string, unknown>) => request('/teachers', { method: 'POST', body: json(data) }, t), update: (t: string, id: string, data: Record<string, unknown>) => request(`/teachers/${id}`, { method: 'PATCH', body: json(data) }, t), remove: (t: string, id: string) => request(`/teachers/${id}`, { method: 'DELETE' }, t) };
export const parentApi = {
 verifyConsent:(t:string,id:string,body:unknown)=>request<any>(`/parents/${id}/consent-verification`,{method:'POST',body:json(body)},t),
  list: (t: string) => request<Parent[]>('/parents', {}, t),
  get: (t: string, id: string) => request<Parent>(`/parents/${id}`, {}, t),
  onboard: (t: string, data: Record<string, unknown>) => request<{ parent: Parent; credentials: { username: string; temporaryPassword: string } | null; verificationRequired: boolean }>('/parents/onboard', { method: 'POST', body: json(data) }, t),
  update: (t: string, id: string, data: Record<string, unknown>) => request<Parent>(`/parents/${id}`, { method: 'PATCH', body: json(data) }, t),
  linkStudent: (t: string, id: string, data: { studentId: string; relationshipType: string; isPrimary: boolean }) => request(`/parents/${id}/students`, { method: 'POST', body: json(data) }, t),
  unlinkStudent: (t: string, id: string, studentId: string) => request(`/parents/${id}/students/${studentId}`, { method: 'DELETE' }, t),
};
export const studentApi = {
  list: (t: string) => request<Student[]>('/students', {}, t),
  get: (t: string, id: string) => request<Student & { studentParents: Array<{ relationshipType:string;isPrimary:boolean;canPickup:boolean;canViewAcademics:boolean;canPayFees:boolean;parent:{id:string;user:{firstName:string;lastName:string;phone?:string|null;email?:string|null}}}> }>(`/students/${id}`, {}, t),
  update: (t: string, id: string, data: Record<string, unknown>) => request<Student>(`/students/${id}`, { method: 'PATCH', body: json(data) }, t),
  remove: (t: string, id: string) => request(`/students/${id}`, { method: 'DELETE' }, t),
};

export const timetableRulesApi = {
 classifyGroupSubjects:(t:string,d:any)=>request<any>('/timetable-planning/group-subjects',{method:'PUT',body:json(d)},t),
 groupWorkspace:(t:string,y:string,g:string)=>request<any>(`/timetable-planning/group-workspace?academicYearId=${y}&groupId=${g}`,{},t),
 saveGroupWorkspace:(t:string,d:any)=>request<any>('/timetable-planning/group-workspace',{method:'PUT',body:json(d)},t),
 simple:(t:string,y:string)=>request<any>(`/timetable-planning/simple-setup?academicYearId=${y}`,{},t),
 saveSimple:(t:string,d:any)=>request<any>('/timetable-planning/simple-setup',{method:'PUT',body:json(d)},t),
 settings:(t:string)=>request<any>('/timetable-planning/settings',{},t),
 saveSettings:(t:string,d:any)=>request<any>('/timetable-planning/settings',{method:'PUT',body:json(d)},t),
 teacher:(t:string,y:string,id:string)=>request<any>(`/timetable-planning/teachers/${id}/config?academicYearId=${y}`,{},t),
 saveTeacher:(t:string,id:string,d:any)=>request<any>(`/timetable-planning/teachers/${id}/config`,{method:'PUT',body:json(d)},t),
 subjects:(t:string,y:string,c:string)=>request<any[]>(`/timetable-planning/subjects/config?academicYearId=${y}&classId=${c}`,{},t),
 saveSubject:(t:string,id:string,d:any)=>request<any>(`/timetable-planning/subjects/${id}/config`,{method:'PUT',body:json(d)},t),
 staffing:(t:string,d:any)=>request<any>('/timetable-planning/staffing',{method:'POST',body:json(d)},t),
 generate:(t:string,d:any)=>request<any>('/timetable-planning/generate-batch',{method:'POST',body:json(d)},t),
 validate:(t:string,id:string)=>request<any>(`/timetable-planning/plans/${id}/validate`,{method:'POST'},t),
};

export const teacherCoverApi={
 alerts:(t:string)=>request<any[]>('/teacher-cover/alerts',{},t),
 readAlert:(t:string,id:string)=>request<any>(`/teacher-cover/alerts/${id}/read`,{method:'PATCH'},t),
 ownAttendance:(t:string)=>request<any>('/attendance/staff/check-in',{},t),
 schedule:(t:string,date:string)=>request<any>(`/teacher-cover/schedule?date=${date}`,{},t),
 list:(t:string,date:string)=>request<any>(`/teacher-cover?date=${date}`,{},t),
 policy:(t:string)=>request<any>('/teacher-cover/policy',{},t),
 savePolicy:(t:string,d:any)=>request<any>('/teacher-cover/policy',{method:'PUT',body:json(d)},t),
 refresh:(t:string,date:string)=>request<any>('/teacher-cover/refresh',{method:'POST',body:json({date})},t),
 assign:(t:string,id:string,teacherId:string,date:string,overrideReason?:string)=>request<any>(`/teacher-cover/${id}/assign`,{method:'PUT',body:json({teacherId,date,overrideReason})},t),
 mark:(t:string,d:any)=>request<any>('/attendance/staff',{method:'POST',body:json(d)},t),
 checkIn:(t:string,d:any={})=>request<any>('/attendance/staff/check-in',{method:'POST',body:json(d)},t),
 notifications:(t:string)=>request<any[]>('/notifications',{},t),
 readNotification:(t:string,id:string)=>request<any>(`/notifications/${id}/read`,{method:'PATCH'},t),
};

export const operationsApi={
 roster:(t:string,date:string)=>request<any>('/attendance/staff/roster?date='+encodeURIComponent(date),{},t),
 bulk:(t:string,d:any)=>request<any>('/attendance/staff/bulk',{method:'POST',body:json(d)},t),
 lock:(t:string,d:any)=>request<any>('/attendance/staff/lock',{method:'POST',body:json(d)},t),
 get:(t:string,path:string)=>request<any>('/school-operations/'+path,{cache:'no-store'},t),
 post:(t:string,path:string,d:any)=>request<any>('/school-operations/'+path,{method:'POST',body:json(d)},t),
 put:(t:string,path:string,d:any)=>request<any>('/school-operations/'+path,{method:'PUT',body:json(d)},t),
 approve:(t:string,id:string,date:string,teacherId:string)=>request<any>('/teacher-cover/'+id+'/assign',{method:'PUT',body:json({date,teacherId})},t),
 cancel:(t:string,id:string,date:string,reason:string)=>request<any>('/teacher-cover/'+id+'/cancel',{method:'POST',body:json({date,reason})},t),
 acknowledge:(t:string,id:string)=>request<any>('/teacher-cover/'+id+'/acknowledge',{method:'POST'},t),
 selfPolicy:(t:string)=>request<any>('/attendance/staff/self-policy',{},t),
 exceptions:(t:string,manage=false)=>request<any[]>('/attendance/staff/exceptions?manage='+manage,{},t),
 requestException:(t:string,d:any)=>request<any>('/attendance/staff/exceptions',{method:'POST',body:json(d)},t),
 decideException:(t:string,id:string,d:any)=>request<any>('/attendance/staff/exceptions/'+id+'/decision',{method:'POST',body:json(d)},t),
 checkOut:(t:string,d:any={})=>request<any>('/attendance/staff/check-out',{method:'POST',body:json(d)},t),
 history:(t:string,staffId:string,from:string,to:string)=>request<any>('/attendance/staff/history?'+new URLSearchParams({staffId,from,to}),{},t)
};

export async function punchAttendance(token:string,kind:'CHECK_IN'|'CHECK_OUT') {
 const own=await operationsApi.selfPolicy(token);
 const input=own.policy.locationVerificationEnabled?{location:await attendanceLocation(typeof navigator==='undefined'?undefined:navigator.geolocation)}:{};
 return kind==='CHECK_IN'?teacherCoverApi.checkIn(token,input):operationsApi.checkOut(token,input);
}

export const studentMigrationApi = {
 list:(t:string,year:string)=>request<any[]>(`/student-migrations?${admissionQuery({academicYearId:year})}`,{},t),
 detail:(t:string,id:string)=>request<any>(`/student-migrations/${id}`,{},t),
 rows:(t:string,id:string,query:Record<string,unknown>)=>request<any>(`/student-migrations/${id}/rows?${admissionQuery(query)}`,{},t),
 create:(t:string,body:unknown)=>request<any>('/student-migrations',{method:'POST',body:json(body)},t),
 action:(t:string,id:string,action:string,body?:unknown,method='POST')=>request<any>(`/student-migrations/${id}/${action}`,{method,body:body===undefined?undefined:json(body)},t),
 get:(t:string,path:string)=>request<any>('/student-migrations/'+path,{},t),
 policy:(t:string,body:unknown)=>request<any>('/student-migrations/policy',{method:'PUT',body:json(body)},t),
 upload:async(t:string,id:string,files:File[])=>{const form=new FormData();files.forEach(file=>form.append('files',file));const response=await fetch(`${API_URL}/student-migrations/${id}/files`,{method:'POST',headers:{Authorization:'Bearer '+t},body:form});const body=await response.json();if(!response.ok)throw new ApiError(messageOf(body),response.status);return body;},
 download:async(t:string,path:string,name:string)=>{const response=await fetch(`${API_URL}/student-migrations/${path}`,{headers:{Authorization:'Bearer '+t}});if(!response.ok)throw new ApiError(messageOf(await response.json()),response.status);const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);},
};
