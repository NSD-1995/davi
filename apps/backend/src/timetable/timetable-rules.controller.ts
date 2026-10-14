import {AcademicGroupSetupService} from './academic-group-setup.service';
import {Body,Controller,Get,Param,Post,Put,Query,Req,UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {PermissionsGuard} from '../auth/permissions.guard';
import {RequirePermissions} from '../auth/permissions.decorator';
import {TimetableRulesService} from './timetable-rules.service';
@Controller('timetable-planning') @UseGuards(JwtAuthGuard,PermissionsGuard)
export class TimetableRulesController {
 constructor(private readonly service:TimetableRulesService,private readonly groups:AcademicGroupSetupService){}
 @Get('group-workspace') @RequirePermissions('TIMETABLE_VIEW') groupWorkspace(@Req()r:any,@Query('academicYearId')y:string,@Query('groupId')g:string){return this.groups.workspace(r.user.schoolId,y,g);}
 @Put('group-workspace') @RequirePermissions('STAFF_UPDATE','TIMETABLE_UPDATE') saveGroupWorkspace(@Req()r:any,@Body()d:any){return this.groups.save(r.user.schoolId,d);}
 @Put('group-subjects') @RequirePermissions('SUBJECT_UPDATE') classifySubjects(@Req()r:any,@Body()d:any){return this.groups.classifySubjects(r.user.schoolId,d);}
 @Get('simple-setup') @RequirePermissions('TIMETABLE_VIEW') simple(@Req()r:any,@Query('academicYearId')y:string){return this.service.simpleSetup(r.user.schoolId,y);}
 @Put('simple-setup') @RequirePermissions('TIMETABLE_UPDATE','CLASS_SUBJECT_MANAGE') saveSimple(@Req()r:any,@Body()d:any){return this.service.saveSimpleSetup(r.user.schoolId,d);}
 @Get('settings') @RequirePermissions('TIMETABLE_VIEW') settings(@Req()r:any){return this.service.settings(r.user.schoolId);}
 @Put('settings') @RequirePermissions('TIMETABLE_UPDATE') save(@Req()r:any,@Body()d:any){return this.service.saveSettings(r.user.schoolId,d);}
 @Get('teachers/:teacherId/config') @RequirePermissions('TIMETABLE_VIEW') teacher(@Req()r:any,@Param('teacherId')id:string,@Query('academicYearId')year:string){return this.service.teacherConfig(r.user.schoolId,year,id);}
 @Put('teachers/:teacherId/config') @RequirePermissions('TIMETABLE_UPDATE') saveTeacher(@Req()r:any,@Param('teacherId')id:string,@Body()d:any){return this.service.saveTeacherConfig(r.user.schoolId,d.academicYearId,id,d);}
 @Get('subjects/config') @RequirePermissions('TIMETABLE_VIEW') subjects(@Req()r:any,@Query()q:any){return this.service.subjectConfigs(r.user.schoolId,q.academicYearId,q.classId);}
 @Put('subjects/:subjectId/config') @RequirePermissions('TIMETABLE_UPDATE') saveSubject(@Req()r:any,@Param('subjectId')id:string,@Body()d:any){return this.service.saveSubjectConfig(r.user.schoolId,d.academicYearId,d.classId,id,d);}
 @Post('staffing') @RequirePermissions('TIMETABLE_VIEW') staffing(@Req()r:any,@Body()d:any){return this.service.staffing(r.user.schoolId,d);}
 @Post('generate-batch') @RequirePermissions('TIMETABLE_GENERATE') generate(@Req()r:any,@Body()d:any){return this.service.generate(r.user.schoolId,d);}
 @Post('plans/:id/validate') @RequirePermissions('TIMETABLE_VIEW') validate(@Req()r:any,@Param('id')id:string){return this.service.validatePlan(r.user.schoolId,id);}
}
