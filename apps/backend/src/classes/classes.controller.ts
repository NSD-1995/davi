import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SchoolClassesService } from './classes.service';
import { CreateClassesBulkDto, CreateSchoolClassDto, ReplaceClassSubjectsDto, UpdateSchoolClassDto } from './classes.dto';

@Controller('classes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchoolClassesController {
  constructor(private readonly schoolClassesService: SchoolClassesService) {}

  @Post('bulk')
  @RequirePermissions('CLASS_CREATE')
  createBulk(@Req() req: any, @Body() dto: CreateClassesBulkDto) {
    return this.schoolClassesService.createBulk(req.user.schoolId, dto);
  }

  @Post()
  @RequirePermissions('CLASS_CREATE')
  create(@Req() req: any, @Body() dto: CreateSchoolClassDto) {
    return this.schoolClassesService.create(req.user.schoolId, dto);
  }

  @Get()
  @RequirePermissions('CLASS_VIEW')
  findAll(@Req() req: any, @Query('status') status?: string) {
    return this.schoolClassesService.findAll(req.user.schoolId, status);
  }

  @Get(':id')
  @RequirePermissions('CLASS_VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.schoolClassesService.findOne(id, req.user.schoolId);
  }

  @Get('schools/:schoolId')
  @RequirePermissions('CLASS_VIEW')
  findBySchool(@Req() req: any, @Param('schoolId') schoolId: string, @Query('status') status?: string) {
    return this.schoolClassesService.findBySchool(schoolId, req.user.schoolId, status);
  }

  @Patch(':id')
  @RequirePermissions('CLASS_UPDATE')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSchoolClassDto) {
    return this.schoolClassesService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions('CLASS_DELETE')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.schoolClassesService.remove(id, req.user.schoolId);
  }
}

@Controller('academic-years/:academicYearId/classes/:classId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassSubjectsController {
  constructor(private readonly schoolClassesService: SchoolClassesService) {}

  @Get('subjects')
  @RequirePermissions('CLASS_SUBJECT_VIEW')
  findSubjects(@Req() req: any, @Param('academicYearId') academicYearId: string, @Param('classId') classId: string) {
    return this.schoolClassesService.findSubjects(req.user.schoolId, academicYearId, classId);
  }

  @Get('available-subjects')
  @RequirePermissions('CLASS_SUBJECT_VIEW')
  availableSubjects(@Req() req: any, @Param('academicYearId') academicYearId: string, @Param('classId') classId: string) {
    return this.schoolClassesService.availableSubjects(req.user.schoolId, academicYearId, classId);
  }

  @Put('subjects')
  @RequirePermissions('CLASS_SUBJECT_MANAGE')
  replaceSubjects(@Req() req: any, @Param('academicYearId') academicYearId: string, @Param('classId') classId: string, @Body() dto: ReplaceClassSubjectsDto) {
    return this.schoolClassesService.replaceSubjects(req.user.schoolId, academicYearId, classId, dto);
  }
}
