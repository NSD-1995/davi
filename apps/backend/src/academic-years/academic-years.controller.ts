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
import { AcademicYearsService } from './academic-years.service';
import { AssignAcademicYearSubjectsDto, CreateAcademicYearDto, UpdateAcademicYearDto } from './academic-years.dto';

@Controller('academic-years')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Post()
  @RequirePermissions('ACADEMIC_YEAR_CREATE')
  create(@Req() req: any, @Body() dto: CreateAcademicYearDto) {
    return this.academicYearsService.create(req.user.schoolId, dto);
  }

  @Get()
  @RequirePermissions('ACADEMIC_YEAR_VIEW')
  findAll(@Req() req: any) {
    return this.academicYearsService.findAll(req.user.schoolId);
  }

  @Post(':id/subjects')
  @RequirePermissions('SUBJECT_UPDATE')
  assignSubjects(@Req() req: any, @Param('id') id: string, @Body() dto: AssignAcademicYearSubjectsDto) {
    return this.academicYearsService.assignSubjects(id, req.user.schoolId, dto);
  }

  @Get(':id/subjects')
  @RequirePermissions('SUBJECT_VIEW')
  findSubjects(@Req() req: any, @Param('id') id: string) {
    return this.academicYearsService.findSubjects(id, req.user.schoolId);
  }

  @Delete(':id/subjects/:subjectId')
  @RequirePermissions('SUBJECT_UPDATE')
  removeSubject(@Req() req: any, @Param('id') id: string, @Param('subjectId') subjectId: string) {
    return this.academicYearsService.removeSubject(id, subjectId, req.user.schoolId);
  }

  @Get(':id')
  @RequirePermissions('ACADEMIC_YEAR_VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.academicYearsService.findOne(id, req.user.schoolId);
  }

  @Get('schools/:schoolId')
  @RequirePermissions('ACADEMIC_YEAR_VIEW')
  findBySchool(@Req() req: any, @Param('schoolId') schoolId: string) {
    return this.academicYearsService.findBySchool(schoolId, req.user.schoolId);
  }

  @Patch(':id')
  @RequirePermissions('ACADEMIC_YEAR_UPDATE')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAcademicYearDto) {
    return this.academicYearsService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions('ACADEMIC_YEAR_UPDATE')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.academicYearsService.remove(id, req.user.schoolId);
  }
}
