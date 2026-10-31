import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EngagementService } from './engagement.service';
@Controller('engagement') @UseGuards(JwtAuthGuard)
export class EngagementController {
 constructor(private service:EngagementService){}
 @Get('context') context(@Req()r:any){return this.service.context(r.user);}
 @Get('alerts') alerts(@Req()r:any){return this.service.personalAlerts(r.user);}
 @Get('query-assignees') assignees(@Req()r:any){return this.service.queryAssignees(r.user);}
 @Patch('alerts/:id/read') readAlert(@Req()r:any,@Param('id')id:string){return this.service.readPersonalAlert(r.user,id);}
 @Get('queries') queries(@Req()r:any,@Query('enrollmentId')e?:string,@Query('page')page?:string){return this.service.queries(r.user,e,page?Number(page):0);}
 @Post('queries') createQuery(@Req()r:any,@Body()d:unknown){return this.service.createQuery(r.user,d);}
 @Get('queries/:id') detail(@Req()r:any,@Param('id')id:string,@Query('before')before?:string){return this.service.detail(r.user,id,before);}
 @Patch('queries/:id') changeQuery(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.service.changeQuery(r.user,id,d);}
 @Put('query-response-policy') policy(@Req()r:any,@Body()d:unknown){return this.service.responsePolicy(r.user,d);}
 @Get('query-response-policy') readPolicy(@Req()r:any){return this.service.readPolicy(r.user);}
 @Get('activities') activities(@Req()r:any,@Query('date')date:string,@Query('academicYearId')year?:string){return this.service.activities(r.user,date,year);}
 @Get('activity-options') options(@Req()r:any,@Query('academicYearId')year:string){return this.service.activityOptions(r.user,year);}
 @Post('activities') createActivity(@Req()r:any,@Body()d:unknown){return this.service.createActivity(r.user,d);}
 @Patch('activities/:id') changeActivity(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.service.changeActivity(r.user,id,d);}
}
