import{Body,Controller,Get,Param,Patch,Post,Put,Query,Req,UseGuards}from'@nestjs/common';
import{JwtAuthGuard}from'../auth/jwt-auth.guard';import{PermissionsGuard}from'../auth/permissions.guard';import{RequirePermissions}from'../auth/permissions.decorator';import{CoverageService}from'./coverage.service';
@Controller('teacher-cover')@UseGuards(JwtAuthGuard,PermissionsGuard)
export class CoverageController{
 constructor(private readonly service:CoverageService){}
 @Get('alerts')alerts(@Req()r:any){return this.service.alerts(r.user.schoolId,r.user.id);}
 @Patch('alerts/:id/read')readAlert(@Req()r:any,@Param('id')id:string){return this.service.readAlert(r.user.schoolId,r.user.id,id);}
 @Get('schedule')@RequirePermissions('TIMETABLE_VIEW')schedule(@Req()r:any,@Query('date')date:string){return this.service.schedule(r.user.schoolId,date);}
 @Get('policy')@RequirePermissions('ATTENDANCE_VIEW','STAFF_VIEW')policy(@Req()r:any){return this.service.policy(r.user.schoolId);}
 @Put('policy')@RequirePermissions('TIMETABLE_UPDATE','ATTENDANCE_MARK','STAFF_UPDATE')savePolicy(@Req()r:any,@Body()d:any){return this.service.savePolicy(r.user.schoolId,d);}
 @Get()@RequirePermissions('ATTENDANCE_VIEW')list(@Req()r:any,@Query('date')date:string){return this.service.list(r.user.schoolId,date);}
 @Post('refresh')@RequirePermissions('ATTENDANCE_MARK','STAFF_VIEW')async refresh(@Req()r:any,@Body()d:any){await this.service.detectMissingCheckIns(r.user.schoolId);return this.service.reconcile(r.user.schoolId,d.date);}
 @Put(':id/assign')@RequirePermissions('TIMETABLE_UPDATE','STAFF_VIEW')assign(@Req()r:any,@Param('id')id:string,@Body()d:any){return this.service.assign(r.user.schoolId,id,d.teacherId,d.date);}
}
