import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const req = context.switchToHttp().getRequest<any>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Authenticated user is required.');
    const requestedSchoolId = req.params?.schoolId;
    if (requestedSchoolId && user.schoolId && requestedSchoolId !== user.schoolId) throw new ForbiddenException('You can only access your own school.');
    const assignments = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    const roleCodes = assignments.map((item) => item.role.code);
    if (roleCodes.includes('SUPER_ADMIN') || roleCodes.includes('SCHOOL_ADMIN')) return true;
    const granted = new Set(assignments.flatMap((item) => item.role.rolePermissions.map((mapping) => mapping.permission.code)));
    if (!required.every((permission) => granted.has(permission))) throw new ForbiddenException(`Missing required permission: ${required.join(', ')}`);
    return true;
  }
}
