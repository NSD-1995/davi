import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SchoolsService } from './schools.service';
import {
  AddUserProfileOptionDto,
  CreateSchoolDto,
  CreateSchoolProfileOptionDto,
  UpdateSchoolDto,
  UpdateSchoolProfileOptionDto,
} from './schools.dto';

@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles('super-admin')
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles('super-admin')
  findAll() {
    return this.schoolsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles('super-admin')
  findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles('super-admin')
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles('super-admin')
  remove(@Param('id') id: string) {
    return this.schoolsService.remove(id);
  }

  @Get(':schoolId/students')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('STUDENT_VIEW')
  findSchoolStudents(@Param('schoolId') schoolId: string) {
    return this.schoolsService.findSchoolStudents(schoolId);
  }

  @Get(':schoolId/teachers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('STAFF_VIEW')
  findSchoolTeachers(@Param('schoolId') schoolId: string) {
    return this.schoolsService.findSchoolTeachers(schoolId);
  }

  @Get(':schoolId/parents')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PARENT_VIEW')
  findSchoolParents(@Param('schoolId') schoolId: string) {
    return this.schoolsService.findSchoolParents(schoolId);
  }

  @Get(':schoolId/profile-options')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('SCHOOL_PROFILE_VIEW')
  findProfileOptions(@Param('schoolId') schoolId: string) {
    return this.schoolsService.findProfileOptions(schoolId);
  }

  @Post(':schoolId/profile-options')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('SCHOOL_PROFILE_UPDATE')
  createProfileOption(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateSchoolProfileOptionDto,
  ) {
    return this.schoolsService.createProfileOption(schoolId, dto);
  }

  @Patch(':schoolId/profile-options/:optionId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('SCHOOL_PROFILE_UPDATE')
  updateProfileOption(
    @Param('schoolId') schoolId: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateSchoolProfileOptionDto,
  ) {
    return this.schoolsService.updateProfileOption(schoolId, optionId, dto);
  }

  @Delete(':schoolId/profile-options/:optionId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('SCHOOL_PROFILE_UPDATE')
  removeProfileOption(
    @Param('schoolId') schoolId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.schoolsService.removeProfileOption(schoolId, optionId);
  }

  @Get(':schoolId/users/:userId/profile-options')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('SCHOOL_PROFILE_VIEW')
  findUserProfileOptions(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
  ) {
    return this.schoolsService.findUserProfileOptions(schoolId, userId);
  }

  @Post(':schoolId/users/:userId/profile-options')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('SCHOOL_PROFILE_UPDATE')
  addUserProfileOption(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() dto: AddUserProfileOptionDto,
  ) {
    return this.schoolsService.addUserProfileOption(schoolId, userId, dto);
  }

  @Delete(':schoolId/users/:userId/profile-options/:optionId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('SCHOOL_PROFILE_UPDATE')
  removeUserProfileOption(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.schoolsService.removeUserProfileOption(schoolId, userId, optionId);
  }
}
