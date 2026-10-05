import { Body,Controller,Get,Param,Patch,Post,Req,UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';import { PermissionsGuard } from '../auth/permissions.guard';import { RequirePermissions } from '../auth/permissions.decorator';import { ClassroomManagementService as S } from './classroom-management.service';
@Controller('academic-years/:yearId/classes/:classId/sections/:sectionId') @UseGuards(JwtAuthGuard,PermissionsGuard)
export class ClassroomManagementController{constructor(private s:S){}
@Get('homework')@RequirePermissions('HOMEWORK_VIEW') homework(@Req()r:any,@Param()p:any){return this.s.homework(r.user.schoolId,p)}
@Post('homework')@RequirePermissions('HOMEWORK_MANAGE') createHomework(@Req()r:any,@Param()p:any,@Body()d:any){return this.s.createHomework(r.user.schoolId,p,d)}
@Patch('homework/:id')@RequirePermissions('HOMEWORK_MANAGE') updateHomework(@Req()r:any,@Param()p:any,@Body()d:any){return this.s.updateHomework(r.user.schoolId,p,d)}
@Get('lesson-plans')@RequirePermissions('LESSON_PLAN_VIEW') lessons(@Req()r:any,@Param()p:any){return this.s.lessons(r.user.schoolId,p)}
@Post('lesson-plans')@RequirePermissions('LESSON_PLAN_MANAGE') createLesson(@Req()r:any,@Param()p:any,@Body()d:any){return this.s.createLesson(r.user.schoolId,p,d)}
@Patch('lesson-plans/:id')@RequirePermissions('LESSON_PLAN_APPROVE') updateLesson(@Req()r:any,@Param()p:any,@Body()d:any){return this.s.updateLesson(r.user.schoolId,p,d)}
@Get('announcements')@RequirePermissions('COMMUNICATION_VIEW') announcements(@Req()r:any,@Param()p:any){return this.s.announcements(r.user.schoolId,p)}
@Post('announcements')@RequirePermissions('COMMUNICATION_MANAGE') createAnnouncement(@Req()r:any,@Param()p:any,@Body()d:any){return this.s.createAnnouncement(r.user.schoolId,p,d)}
@Patch('announcements/:id')@RequirePermissions('COMMUNICATION_MANAGE') updateAnnouncement(@Req()r:any,@Param()p:any,@Body()d:any){return this.s.updateAnnouncement(r.user.schoolId,p,d)}
@Get('calendar')@RequirePermissions('EVENT_VIEW') calendar(@Req()r:any,@Param()p:any){return this.s.calendar(r.user.schoolId,p)}
@Get('analysis')@RequirePermissions('REPORT_VIEW') analysis(@Req()r:any,@Param()p:any){return this.s.analysis(r.user.schoolId,p)}
@Get('settings')@RequirePermissions('CLASS_VIEW') settings(@Req()r:any,@Param()p:any){return this.s.settings(r.user.schoolId,p)}
@Patch('settings')@RequirePermissions('CLASS_UPDATE') updateSettings(@Req()r:any,@Param()p:any,@Body()d:any){return this.s.updateSettings(r.user.schoolId,p,d)}
}
