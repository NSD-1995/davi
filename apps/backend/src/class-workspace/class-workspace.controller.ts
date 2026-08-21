import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ReplaceClassTeacherDto } from '../teachers/teachers.dto';
import { TeachersService } from '../teachers/teachers.service';
import { ClassWorkspaceService } from './class-workspace.service';

@Controller('academic-years/:academicYearId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassWorkspaceController {
  constructor(private readonly workspace: ClassWorkspaceService, private readonly teachers: TeachersService) {}
  @Get('class-workspaces') @RequirePermissions('CLASS_VIEW') workspaces(@Req() req: any, @Param('academicYearId') yearId: string) { return this.workspace.workspaces(req.user.schoolId, yearId); }
  @Get('classes/:classId/sections/:sectionId/dashboard') @RequirePermissions('CLASS_VIEW') dashboard(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string) { return this.workspace.dashboard(req.user.schoolId, yearId, classId, sectionId); }
  @Get('classes/:classId/sections/:sectionId/students') @RequirePermissions('STUDENT_VIEW') students(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string) { return this.workspace.students(req.user.schoolId, yearId, classId, sectionId); }
  @Put('classes/:classId/sections/:sectionId/class-teacher') @RequirePermissions('STAFF_UPDATE') assignTeacher(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string, @Body() dto: ReplaceClassTeacherDto) { return this.teachers.replaceClassTeacher(req.user.schoolId, yearId, classId, sectionId, dto.teacherId); }
  @Get('classes/:classId/sections/:sectionId/class-teacher') @RequirePermissions('STAFF_VIEW') classTeacher(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string) { return this.teachers.getClassTeacher(req.user.schoolId, yearId, classId, sectionId); }
  @Delete('classes/:classId/sections/:sectionId/class-teacher') @RequirePermissions('STAFF_UPDATE') removeTeacher(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string) { return this.teachers.removeClassTeacher(req.user.schoolId, yearId, classId, sectionId); }
}
