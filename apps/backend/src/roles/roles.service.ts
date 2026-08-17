import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto, UpdateRolePermissionsDto } from './roles.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(schoolId: string, actorSchoolId: string | null) { this.assertSchool(schoolId, actorSchoolId); return this.prisma.role.findMany({ where: { schoolId }, include: { _count: { select: { userRoles: true, rolePermissions: true } } }, orderBy: { createdAt: 'asc' } }); }
  async findOne(schoolId: string, id: string, actorSchoolId: string | null) { this.assertSchool(schoolId, actorSchoolId); const role = await this.prisma.role.findFirst({ where: { id, schoolId }, include: { rolePermissions: { include: { permission: true } } } }); if (!role) throw new NotFoundException(`Role ${id} not found for this school.`); return role; }
  async create(schoolId: string, actorSchoolId: string | null, data: CreateRoleDto) {
    this.assertSchool(schoolId, actorSchoolId); const name = this.required(data.name, 'name'); const code = this.code(this.required(data.code, 'code'));
    if (!await this.prisma.school.findUnique({ where: { id: schoolId } })) throw new NotFoundException(`School with id ${schoolId} not found.`);
    if (await this.prisma.role.findUnique({ where: { schoolId_code: { schoolId, code } } })) throw new ConflictException('Role code already exists within this school.');
    return this.prisma.role.create({ data: { schoolId, name, code, description: data.description ?? null } });
  }
  async update(schoolId: string, id: string, actorSchoolId: string | null, data: UpdateRoleDto) {
    const role = await this.findOne(schoolId, id, actorSchoolId); const code = data.code === undefined ? undefined : this.code(this.required(data.code, 'code'));
    if (role.isSystem && code && code !== role.code) throw new BadRequestException('A system role code cannot be changed.');
    if (code && await this.prisma.role.findFirst({ where: { schoolId, code, id: { not: id } } })) throw new ConflictException('Role code already exists within this school.');
    return this.prisma.role.update({ where: { id }, data: { ...(data.name !== undefined ? { name: this.required(data.name, 'name') } : {}), ...(code ? { code } : {}), ...(data.description !== undefined ? { description: data.description } : {}), ...(data.isActive !== undefined ? { isActive: data.isActive } : {}) } });
  }
  async remove(schoolId: string, id: string, actorSchoolId: string | null) { const role = await this.findOne(schoolId, id, actorSchoolId); if (role.isSystem) throw new ConflictException('System roles cannot be deleted.'); if (await this.prisma.userRole.count({ where: { roleId: id } })) throw new ConflictException('Role is assigned to users. Deactivate it instead.'); return this.prisma.role.delete({ where: { id } }); }
  async getPermissions(schoolId: string, id: string, actorSchoolId: string | null) { const role = await this.findOne(schoolId, id, actorSchoolId); return { role: { id: role.id, name: role.name, code: role.code }, permissions: role.rolePermissions.map((item) => item.permission) }; }
  async replacePermissions(schoolId: string, id: string, actorSchoolId: string | null, data: UpdateRolePermissionsDto) {
    const role = await this.findOne(schoolId, id, actorSchoolId); if (role.isSystem && role.code === 'SCHOOL_ADMIN') throw new ConflictException('SCHOOL_ADMIN has protected full access; its permissions cannot be restricted.');
    if (!Array.isArray(data.permissionIds)) throw new BadRequestException('permissionIds must be an array.'); const ids = [...new Set(data.permissionIds)];
    if ((await this.prisma.permission.count({ where: { id: { in: ids } } })) !== ids.length) throw new NotFoundException('One or more permissions were not found.');
    await this.prisma.$transaction(async (tx) => { await tx.rolePermission.deleteMany({ where: { roleId: id } }); if (ids.length) await tx.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: id, permissionId })) }); });
    return this.getPermissions(schoolId, id, actorSchoolId);
  }
  private assertSchool(schoolId: string, actorSchoolId: string | null) { if (!actorSchoolId || schoolId !== actorSchoolId) throw new ForbiddenException('You can only manage roles for your own school.'); }
  private required(value: string | undefined, field: string) { if (!value?.trim()) throw new BadRequestException(`${field} is required.`); return value.trim(); }
  private code(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_'); }
}
