import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('STAFF_CREATE')
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.usersService.create(req.user.schoolId, dto);
  }

  @Get()
  @RequirePermissions('STAFF_VIEW')
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.user.schoolId);
  }

  @Get(':id')
  @RequirePermissions('STAFF_VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.usersService.findOne(id, req.user.schoolId);
  }

  @Patch(':id')
  @RequirePermissions('STAFF_UPDATE')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions('STAFF_DELETE')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.usersService.remove(id, req.user.schoolId);
  }

  @Get(':id/roles')
  @RequirePermissions('ROLE_VIEW')
  findRoles(@Req() req: any, @Param('id') id: string) {
    return this.usersService.findRoles(id, req.user.schoolId);
  }

  @Post(':id/roles')
  @RequirePermissions('ROLE_PERMISSION_MANAGE')
  addRole(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.usersService.assignRole(id, req.user.schoolId, dto);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions('ROLE_PERMISSION_MANAGE')
  removeRole(@Req() req: any, @Param('id') id: string, @Param('roleId') roleId: string) {
    return this.usersService.removeRole(id, roleId, req.user.schoolId);
  }
}
