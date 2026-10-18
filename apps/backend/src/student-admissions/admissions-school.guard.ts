import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

/** Uses the existing RBAC mappings, restricted to the authenticated tenant. */
@Injectable()
export class AdmissionsSchoolGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest<any>().user;
    if (!user?.schoolId) throw new ForbiddenException('An authenticated school membership is required.');
    const assignments = await this.db.userRole.findMany({ where: { userId: user.id, schoolId: user.schoolId, user: { status: 'ACTIVE' }, role: { schoolId: user.schoolId, isActive: true } }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } });
    if (!assignments.length) throw new ForbiddenException('An active role in this school is required.');
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) || [];
    const granted = new Set(assignments.flatMap(assignment => assignment.role.rolePermissions.map(mapping => mapping.permission.code)));
    if (!assignments.some(assignment => assignment.role.code === 'SCHOOL_ADMIN') && !required.every(code => granted.has(code))) throw new ForbiddenException(`Missing required permission: ${required.join(', ')}`);
    return true;
  }
}
