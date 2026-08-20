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
import { SchoolSettingsService } from './school-settings.service';
import { CreateSchoolSettingDto, UpdateSchoolSettingDto } from './school-settings.dto';

@Controller('school-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchoolSettingsController {
  constructor(private readonly schoolSettingsService: SchoolSettingsService) {}

  @Post()
  @RequirePermissions('SCHOOL_PROFILE_UPDATE')
  create(@Req() req: any, @Body() dto: CreateSchoolSettingDto) {
    return this.schoolSettingsService.create(req.user.schoolId, dto);
  }

  @Get()
  @RequirePermissions('SCHOOL_PROFILE_VIEW')
  findAll(@Req() req: any) {
    return this.schoolSettingsService.findAll(req.user.schoolId);
  }

  @Get('schools/:schoolId')
  @RequirePermissions('SCHOOL_PROFILE_VIEW')
  findBySchoolId(@Req() req: any, @Param('schoolId') schoolId: string) {
    return this.schoolSettingsService.findBySchoolId(schoolId, req.user.schoolId);
  }

  @Get(':id')
  @RequirePermissions('SCHOOL_PROFILE_VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.schoolSettingsService.findOne(id, req.user.schoolId);
  }

  @Patch(':id')
  @RequirePermissions('SCHOOL_PROFILE_UPDATE')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSchoolSettingDto) {
    return this.schoolSettingsService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions('SCHOOL_PROFILE_UPDATE')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.schoolSettingsService.remove(id, req.user.schoolId);
  }
}
