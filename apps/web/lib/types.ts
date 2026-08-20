export type Status = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export interface School { id: string; name: string; shortName?: string | null; address?: string | null; city?: string | null; country?: string | null; phone?: string | null; email?: string | null; website?: string | null }
export interface User { id: string; schoolId: string | null; email?: string; username?: string | null; firstName: string; lastName: string; mustChangePassword: boolean; school?: School | null }
export interface RoleSummary { id: string; name: string; code: string }
export interface Session { token: string; user: User; roles: RoleSummary[]; permissions: string[] }
export interface AcademicYear { id: string; schoolId: string; name: string; startDate?: string | null; endDate?: string | null; isCurrent: boolean; status: string }
export interface Section { id: string; classId: string; name: string; capacity?: number | null; status: string }
export interface SchoolClass { id: string; academicYearId: string; name: string; code?: string | null; capacity?: number | null; status: string; sections: Section[] }
export interface Subject { id: string; schoolId: string; name: string; code: string; description?: string | null; type: 'CORE' | 'ELECTIVE' | 'OPTIONAL'; status: string }
export interface Permission { id: string; code: string; module: string; action: string; name?: string; description?: string | null }
export interface Role { id: string; name: string; code: string; description?: string | null; isSystem: boolean; isActive: boolean; _count?: { userRoles: number; rolePermissions: number } }
export interface Staff { id: string; userId: string; employeeId: string; joiningDate?: string | null; status: Status; user: User & { phone?: string | null; status: Status; roles: Array<{ role: RoleSummary }> } }
export interface DashboardSummary { currentAcademicYear: AcademicYear | null; counts: { classes: number; sections: number; subjects: number; staff: number } }
