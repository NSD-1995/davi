import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateRoleDto, UpdateRoleDto, UpdateRolePermissionsDto } from './roles.dto';
import { RolesService } from './roles.service';

@Controller('schools/:schoolId/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly service: RolesService) {}
  @Post() @RequirePermissions('ROLE_CREATE') create(@Req() req: any, @Param('schoolId') schoolId: string, @Body() dto: CreateRoleDto) { return this.service.create(schoolId, req.user.schoolId, dto); }
  @Get() @RequirePermissions('ROLE_VIEW') all(@Req() req: any, @Param('schoolId') schoolId: string) { return this.service.findAll(schoolId, req.user.schoolId); }
  @Get(':roleId') @RequirePermissions('ROLE_VIEW') one(@Req() req: any, @Param('schoolId') schoolId: string, @Param('roleId') id: string) { return this.service.findOne(schoolId, id, req.user.schoolId); }
  @Patch(':roleId') @RequirePermissions('ROLE_UPDATE') update(@Req() req: any, @Param('schoolId') schoolId: string, @Param('roleId') id: string, @Body() dto: UpdateRoleDto) { return this.service.update(schoolId, id, req.user.schoolId, dto); }
  @Delete(':roleId') @RequirePermissions('ROLE_DELETE') remove(@Req() req: any, @Param('schoolId') schoolId: string, @Param('roleId') id: string) { return this.service.remove(schoolId, id, req.user.schoolId); }
  @Get(':roleId/permissions') @RequirePermissions('ROLE_VIEW') permissions(@Req() req: any, @Param('schoolId') schoolId: string, @Param('roleId') id: string) { return this.service.getPermissions(schoolId, id, req.user.schoolId); }
  @Put(':roleId/permissions') @RequirePermissions('ROLE_PERMISSION_MANAGE') replace(@Req() req: any, @Param('schoolId') schoolId: string, @Param('roleId') id: string, @Body() dto: UpdateRolePermissionsDto) { return this.service.replacePermissions(schoolId, id, req.user.schoolId, dto); }
}
