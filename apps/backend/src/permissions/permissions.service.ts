import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll() {
    const permissions = await this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
    const groups = new Map<string, typeof permissions>();
    for (const permission of permissions) groups.set(permission.module, [...(groups.get(permission.module) ?? []), permission]);
    return [...groups].map(([module, items]) => ({ module, permissions: items }));
  }
}
