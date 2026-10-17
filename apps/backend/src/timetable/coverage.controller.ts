import {Body,Controller,Get,Param,Patch,Post,Put,Query,Req,UseGuards,ForbiddenException} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {OperationsAccessService} from '../auth/operations-access.service';
import {CoverageService} from './coverage.service';
@Controller('teacher-cover') @UseGuards(JwtAuthGuard)
export class CoverageController {
 constructor(private readonly service:CoverageService,private readonly access:OperationsAccessService){}
 @Get('alerts') alerts(@Req()r:any){return this.service.alerts(r.user.schoolId,r.user.id);}
 @Patch('alerts/:id/read') readAlert(@Req()r:any,@Param('id')id:string){return this.service.readAlert(r.user.schoolId,r.user.id,id);}
 @Get('schedule') async schedule(@Req()r:any,@Query('date')date:string){const actor=await this.access.actor(r.user.schoolId,r.user.id,'timetable.substitution.view');const result=await this.service.schedule(r.user.schoolId,date);return{...result,covers:result.covers.filter((c:any)=>c.target&&this.access.matchesTarget(actor,c.target))};}
 @Get('policy') async policy(@Req()r:any){try{await this.access.actor(r.user.schoolId,r.user.id,'staff.attendance.view');}catch(error){if(!(error instanceof ForbiddenException))throw error;await this.access.actor(r.user.schoolId,r.user.id,'timetable.substitution.view');}return this.service.policy(r.user.schoolId);}
 @Put('policy') async savePolicy(@Req()r:any,@Body()d:any){const actor=await this.access.actor(r.user.schoolId,r.user.id,'staff.attendance.manage');if(!actor.admin)throw new ForbiddenException('School automation settings require an administrator.');return this.service.savePolicy(r.user.schoolId,d);}
 @Get() async list(@Req()r:any,@Query('date')date:string){const {actor,rows}=await this.access.staff(r.user.schoolId,r.user.id,'timetable.substitution.view');const ids=new Set(rows.map((s:any)=>s.id)),result=await this.service.list(r.user.schoolId,date);return{...result,teachers:result.teachers.filter((t:any)=>ids.has(t.staffId)),covers:result.covers.filter((sub:any)=>sub.target&&this.access.matchesTarget(actor,sub.target))};}
 @Post('refresh') async refresh(@Req()r:any,@Body()d:any){await this.access.actor(r.user.schoolId,r.user.id,'timetable.substitution.generate');await this.service.detectMissingCheckIns(r.user.schoolId);await this.service.reconcile(r.user.schoolId,d.date,new Date(),true);return this.list(r,d.date);}
 @Put(':id/assign') assign(@Req()r:any,@Param('id')id:string,@Body()d:any){return this.service.assign(r.user.schoolId,id,d.teacherId,d.date,r.user.id,d.overrideReason);}
 @Post(':id/cancel') cancel(@Req()r:any,@Param('id')id:string,@Body()d:any){return this.service.cancel(r.user.schoolId,r.user.id,id,d.date,d.reason);}
 @Post(':id/acknowledge') acknowledge(@Req()r:any,@Param('id')id:string){return this.service.acknowledge(r.user.schoolId,r.user.id,id);}
}
