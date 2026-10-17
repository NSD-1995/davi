import { ForbiddenException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { RequirePermissions } from '../auth/permissions.decorator'; import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateStaffDto, UpdateStaffDto } from './staff.dto'; import { StaffService } from './staff.service';
import {StaffCategoryService} from './staff-category.service';
@Controller('schools/:schoolId/staff') @UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffController {
  constructor(private readonly service: StaffService,private readonly categories:StaffCategoryService) {}
  @Get('categories') categoriesList(@Req()req:any,@Param('schoolId')s:string){if(s!==req.user.schoolId)throw new ForbiddenException('You can only access your school.');return this.categories.list(s,req.user.id);}
  @Post('categories') @RequirePermissions('STAFF_CATEGORY_MANAGE') categoryCreate(@Req()req:any,@Param('schoolId')s:string,@Body()data:any){return this.categories.create(s,req.user.id,data);}
  @Post() @RequirePermissions('STAFF_CREATE') create(@Req() req: any, @Param('schoolId') schoolId: string, @Body() dto: CreateStaffDto) { return this.service.create(schoolId, req.user.schoolId, dto); }
  @Get() @RequirePermissions('STAFF_VIEW') all(@Req() req: any, @Param('schoolId') schoolId: string) { return this.service.findAll(schoolId, req.user.schoolId); }
  @Get(':staffId') @RequirePermissions('STAFF_VIEW') one(@Req() req: any, @Param('schoolId') schoolId: string, @Param('staffId') id: string) { return this.service.findOne(schoolId, id, req.user.schoolId); }
  @Patch(':staffId') @RequirePermissions('STAFF_UPDATE') update(@Req() req: any, @Param('schoolId') schoolId: string, @Param('staffId') id: string, @Body() dto: UpdateStaffDto) { return this.service.update(schoolId, id, req.user.schoolId, dto); }
  @Delete(':staffId') @RequirePermissions('STAFF_DELETE') deactivate(@Req() req: any, @Param('schoolId') schoolId: string, @Param('staffId') id: string) { return this.service.deactivate(schoolId, id, req.user.schoolId); }
}
