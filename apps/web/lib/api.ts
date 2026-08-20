import type { AcademicYear, DashboardSummary, Permission, Role, School, SchoolClass, Section, Staff, Subject, User } from './types';

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
