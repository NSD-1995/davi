import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { academicGroup } from '../academic-groups';
@Injectable()
export class OperationsAccessService {
    constructor(private readonly db: PrismaService) { }
    async actor(s: string | null, userId: string, permission?: string, client: any = this.db) {
        if (!s)
            throw new ForbiddenException('A school account is required.');
        const user = await client.user.findFirst({ where: { id: userId, schoolId: s, status: 'ACTIVE' }, include: { roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } } });
        if (!user)
            throw new ForbiddenException('Active school membership required.');
        const roles = user.roles.filter((r: any) => r.role.isActive && (r.role.schoolId === s || r.role.schoolId === null));
        const admin = roles.some((r: any) => ['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(r.role.code));
        const permissions = new Set<string>(roles.flatMap((r: any) => r.role.rolePermissions.map((p: any) => p.permission.code)));
        const legacy: Record<string, string[]> = { 'staff.attendance.view': ['ATTENDANCE_VIEW'], 'staff.attendance.mark': ['ATTENDANCE_MARK', 'STAFF_UPDATE'], 'staff.attendance.override': ['ATTENDANCE_UPDATE', 'STAFF_UPDATE'], 'staff.attendance.manage': ['ATTENDANCE_UPDATE', 'STAFF_UPDATE'], 'timetable.substitution.view': ['ATTENDANCE_VIEW', 'STAFF_VIEW'], 'timetable.substitution.generate': ['TIMETABLE_UPDATE', 'STAFF_VIEW'], 'timetable.substitution.approve': ['TIMETABLE_UPDATE', 'STAFF_VIEW'], 'timetable.substitution.cancel': ['TIMETABLE_UPDATE', 'STAFF_VIEW'] };
        if (permission && !admin && !permissions.has(permission) && !(legacy[permission]?.every(p => permissions.has(p))))
            throw new ForbiddenException('Missing required permission: ' + permission);
        const scope = admin ? null : await client.staffScopeAssignment.findUnique({ where: { schoolId_userId: { schoolId: s, userId } } });
        const setting = await client.schoolSetting.findUnique({ where: { schoolId: s } });
        return { departmentOptionId: (setting?.operationsPolicy as any)?.departmentOptionId, userId, schoolId: s, admin, permissions, scope };
    }
    matchesStaff(actor: any, staff: any) {
        if (actor.admin)
            return true;
        const scope = actor.scope;
        if (!scope)
            return false;
        if(scope.schoolWide)return true;
        if (scope.staffIds.includes(staff.id))
            return true;
        if (actor.departmentOptionId && staff.user?.profileOptions?.some((p: any) => p.optionId === actor.departmentOptionId && scope.departmentValues?.includes(p.value)))
            return true;
        const teacher = staff.user?.teacher;
        if (!teacher)
            return false;
        const rows = (teacher.timetableEligibility as any)?.groupResponsibilities || [];
        const assignments = teacher.academicAssignments || [];
        return rows.some((r: any) => scope.groupIds.includes(r.groupId) && r.subjectIds?.length) || assignments.some((a: any) => scope.classIds.includes(a.classId) || scope.sectionIds.includes(a.sectionId) || scope.groupIds.includes(academicGroup(a.schoolClass)));
    }
    matchesTarget(actor: any, target: any) { return actor.admin || !!actor.scope && (actor.scope.schoolWide || actor.scope.groupIds.includes(academicGroup({ name: target.className, academicGroup: target.academicGroup })) || actor.scope.classIds.includes(target.classId) || actor.scope.sectionIds.includes(target.sectionId)); }
    async staff(s: string, userId: string, permission: string, client: any = this.db) { const actor = await this.actor(s, userId, permission, client); const rows = await client.staff.findMany({ where: { schoolId: s, status: 'ACTIVE', user: { status: 'ACTIVE' } }, include: { user: { select: { id: true, firstName: true, lastName: true, profileOptions: { select: { optionId: true, value: true } }, teacher: { include: { academicAssignments: { where: { isActive: true }, include: { schoolClass: true } } } } } } } }); return { actor, rows: rows.filter((r: any) => this.matchesStaff(actor, r) || (!permission && r.userId === userId)) }; }
}
