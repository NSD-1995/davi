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
import { StudentsService } from './students.service';
import { CreateStudentDto, EnrollStudentDto, UpdateStudentDto, UpdateStudentEnrollmentDto } from './students.dto';

@Controller('students')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @RequirePermissions('STUDENT_CREATE')
  create(@Req() req: any, @Body() dto: CreateStudentDto) {
    return this.studentsService.create(req.user.schoolId, dto);
  }

  @Get()
  @RequirePermissions('STUDENT_VIEW')
  findAll(@Req() req: any) {
    return this.studentsService.findAll(req.user.schoolId);
  }

  @Get(':id')
  @RequirePermissions('STUDENT_VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.studentsService.findOne(id, req.user.schoolId);
  }

  @Patch(':id')
  @RequirePermissions('STUDENT_UPDATE')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions('STUDENT_DELETE')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.studentsService.remove(id, req.user.schoolId);
  }

  @Post(':id/enrollments')
  @RequirePermissions('STUDENT_UPDATE')
  enroll(@Req() req: any, @Param('id') id: string, @Body() dto: EnrollStudentDto) {
    return this.studentsService.enroll(id, req.user.schoolId, dto);
  }

  @Get(':id/enrollments')
  @RequirePermissions('STUDENT_VIEW')
  enrollments(@Req() req: any, @Param('id') id: string) {
    return this.studentsService.findEnrollments(id, req.user.schoolId);
  }

  @Patch(':id/enrollments/:enrollmentId')
  @RequirePermissions('STUDENT_UPDATE')
  updateEnrollment(@Req() req: any, @Param('id') id: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: UpdateStudentEnrollmentDto) {
    return this.studentsService.updateEnrollment(id, enrollmentId, req.user.schoolId, dto);
  }
}
