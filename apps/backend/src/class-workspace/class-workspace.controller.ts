import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ReplaceClassTeacherDto } from '../teachers/teachers.dto';
import { TeachersService } from '../teachers/teachers.service';
import { ClassWorkspaceService } from './class-workspace.service';
import { ReplaceSubjectTeachersDto, ReplaceTeachingTeamDto } from './teaching-assignments.dto';
import { TeachingAssignmentsService } from './teaching-assignments.service';

@Controller('academic-years/:academicYearId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassWorkspaceController {
  constructor(private readonly workspace: ClassWorkspaceService, private readonly teachers: TeachersService, private readonly assignments: TeachingAssignmentsService) {}
  @Get('class-workspaces') @RequirePermissions('CLASS_VIEW') workspaces(@Req() req: any, @Param('academicYearId') yearId: string) { return this.workspace.workspaces(req.user.schoolId, yearId); }
  @Get('classes/:classId/sections/:sectionId/dashboard') @RequirePermissions('CLASS_VIEW') dashboard(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string) { return this.workspace.dashboard(req.user.schoolId, yearId, classId, sectionId); }
  @Get('classes/:classId/sections/:sectionId/students') @RequirePermissions('STUDENT_VIEW') students(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string) { return this.workspace.students(req.user.schoolId, yearId, classId, sectionId); }
  @Put('classes/:classId/sections/:sectionId/class-teacher') @RequirePermissions('STAFF_UPDATE') assignTeacher(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string, @Body() dto: ReplaceClassTeacherDto) { return this.teachers.replaceClassTeacher(req.user.schoolId, yearId, classId, sectionId, dto.teacherId); }
  @Get('classes/:classId/sections/:sectionId/class-teacher') @RequirePermissions('STAFF_VIEW') classTeacher(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string) { return this.teachers.getClassTeacher(req.user.schoolId, yearId, classId, sectionId); }
  @Delete('classes/:classId/sections/:sectionId/class-teacher') @RequirePermissions('STAFF_UPDATE') removeTeacher(@Req() req: any, @Param('academicYearId') yearId: string, @Param('classId') classId: string, @Param('sectionId') sectionId: string) { return this.teachers.removeClassTeacher(req.user.schoolId, yearId, classId, sectionId); }
  @Get('classes/:classId/sections/:sectionId/teaching-team') @RequirePermissions('TEACHING_TEAM_VIEW') teachingTeam(@Req() req:any,@Param('academicYearId') yearId:string,@Param('classId') classId:string,@Param('sectionId') sectionId:string){return this.assignments.teachingTeam(req.user.schoolId,yearId,classId,sectionId);}
  @Put('classes/:classId/sections/:sectionId/teaching-team') @RequirePermissions('TEACHING_TEAM_MANAGE') replaceTeachingTeam(@Req() req:any,@Param('academicYearId') yearId:string,@Param('classId') classId:string,@Param('sectionId') sectionId:string,@Body() dto:ReplaceTeachingTeamDto){return this.assignments.replaceTeachingTeam(req.user.schoolId,yearId,classId,sectionId,dto);}
  @Get('classes/:classId/sections/:sectionId/subject-teachers') @RequirePermissions('SUBJECT_TEACHER_VIEW') subjectTeachers(@Req() req:any,@Param('academicYearId') yearId:string,@Param('classId') classId:string,@Param('sectionId') sectionId:string){return this.assignments.subjectTeachers(req.user.schoolId,yearId,classId,sectionId);}
  @Put('classes/:classId/sections/:sectionId/subject-teachers') @RequirePermissions('SUBJECT_TEACHER_MANAGE') replaceSubjectTeachers(@Req() req:any,@Param('academicYearId') yearId:string,@Param('classId') classId:string,@Param('sectionId') sectionId:string,@Body() dto:ReplaceSubjectTeachersDto){return this.assignments.replaceSubjectTeachers(req.user.schoolId,yearId,classId,sectionId,dto);}
  @Get('staff/:staffId/workload') @RequirePermissions('TEACHING_TEAM_VIEW') workload(@Req() req:any,@Param('academicYearId') yearId:string,@Param('staffId') staffId:string){return this.assignments.workload(req.user.schoolId,yearId,staffId);}
}
