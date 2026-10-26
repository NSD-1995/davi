import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsAttention } from './analytics-attention';
import { AnalyticsExports } from './analytics-exports';
import { AnalyticsInsights } from './analytics-insights';
@Controller('reports/analytics') @UseGuards(JwtAuthGuard,PermissionsGuard) @RequirePermissions('REPORT_VIEW')
export class AnalyticsController {
 constructor(private service:AnalyticsService,private attention:AnalyticsAttention,private exports:AnalyticsExports,private insights:AnalyticsInsights){}
 @Get('options') options(@Req()r:any,@Query('academicYearId')year:string){return this.service.options(r.user,year);}
 @Get('students') students(@Req()r:any,@Query()q:any){return this.service.students(r.user,q);}
 @Post('snapshots') snapshot(@Req()r:any,@Body()d:any){return this.service.snapshot(r.user,d.filters,d.refresh===true);}
 @Get('snapshots/:id/students') page(@Req()r:any,@Param('id')id:string,@Query('page')page:string){return this.service.page(r.user,id,Number(page||1));}
 @Get('snapshots/:id/table') table(@Req()r:any,@Param('id')id:string,@Query('key')key:string,@Query('page')page:string){return this.service.table(r.user,id,key,Number(page||1));}
 @Get('attention') cases(@Req()r:any,@Query()q:any){return this.attention.list(r.user,q);}
 @Post('attention') createCase(@Req()r:any,@Body()d:any){return this.attention.create(r.user,d);}
 @Patch('attention/:id') updateCase(@Req()r:any,@Param('id')id:string,@Body()d:any){return this.attention.update(r.user,id,d);}
 @Put('policy') policy(@Req()r:any,@Body()d:any){return this.attention.policy(r.user,d.academicYearId,d.policy);}
 @Get('exports') jobs(@Req()r:any){return this.exports.history(r.user);}
 @Post('exports') requestExport(@Req()r:any,@Body()d:any){return this.exports.request(r.user,d);}
 @Post('exports/:id/action') action(@Req()r:any,@Param('id')id:string,@Body()d:any){return this.exports.action(r.user,id,d.action);}
 @Post('exports/:id/ticket') ticket(@Req()r:any,@Param('id')id:string){return this.exports.ticket(r.user,id);}
 @Get('exports/:id/download') async download(@Req()r:any,@Param('id')id:string,@Query('token')token:string,@Res()res:any){const {job,buffer}=await this.exports.download(r.user,id,token);const types:any={PDF:'application/pdf',XLSX:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',CSV:'text/csv; charset=utf-8'};res.setHeader('Content-Type',types[job.format]);res.setHeader('Content-Disposition','attachment; filename="DAVI-'+job.template+'-'+job.id+'.'+job.format.toLowerCase()+'"');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.send(buffer);}
 @Post('insights') generate(@Req()r:any,@Body()d:any){return this.insights.generate(r.user,d.snapshotId);}
 @Post('insights/:id/approve') approve(@Req()r:any,@Param('id')id:string){return this.insights.approve(r.user,id);}
}
