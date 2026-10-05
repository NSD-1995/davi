import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { WorkflowService } from './workflow.service';

@Controller('academic-programs') @UseGuards(JwtAuthGuard,PermissionsGuard)
export class WorkflowController {
  constructor(private readonly service:WorkflowService){}
  @Get() @RequirePermissions('LESSON_PLAN_VIEW') list(@Req() r:any,@Query() q:any){return this.service.list(r.user,q);}
  @Post() @RequirePermissions('LESSON_PLAN_MANAGE') create(@Req() r:any,@Body() d:unknown){return this.service.create(r.user,d);}
  @Get(':id') @RequirePermissions('LESSON_PLAN_VIEW') get(@Req() r:any,@Param('id') id:string){return this.service.get(r.user,id);}
  @Post(':id/analyze') @RequirePermissions('LESSON_PLAN_MANAGE') analyze(@Req() r:any,@Param('id') id:string){return this.service.analyze(r.user,id);}
  @Patch(':id/review') @RequirePermissions('LESSON_PLAN_MANAGE') review(@Req() r:any,@Param('id') id:string,@Body() d:unknown){return this.service.review(r.user,id,d);}
  @Post(':id/approve') @RequirePermissions('LESSON_PLAN_APPROVE') approve(@Req() r:any,@Param('id') id:string,@Body() d:unknown){return this.service.approve(r.user,id,d);}
  @Patch(':id/calendar') @RequirePermissions('LESSON_PLAN_APPROVE') calendar(@Req() r:any,@Param('id') id:string,@Body() d:unknown){return this.service.updateCalendar(r.user,id,d);}
  @Post(':id/plan') @RequirePermissions('LESSON_PLAN_MANAGE') plan(@Req() r:any,@Param('id') id:string,@Body() d:unknown){return this.service.plan(r.user,id,d);}
  @Patch(':id/sessions/:sessionId/progress') @RequirePermissions('LESSON_PLAN_MANAGE') progress(@Req() r:any,@Param() p:any,@Body() d:unknown){return this.service.progress(r.user,p.id,p.sessionId,d);}
  @Post(':id/sessions/:sessionId/generate') @RequirePermissions('LESSON_PLAN_MANAGE') lesson(@Req() r:any,@Param() p:any){return this.service.generateLesson(r.user,p.id,p.sessionId);}
  @Patch(':id/sessions/:sessionId/review') @RequirePermissions('LESSON_PLAN_MANAGE') reviewLesson(@Req() r:any,@Param() p:any,@Body() d:unknown){return this.service.reviewLesson(r.user,p.id,p.sessionId,d);}
  @Post(':id/sessions/:sessionId/approve') @RequirePermissions('LESSON_PLAN_APPROVE') approveLesson(@Req() r:any,@Param() p:any,@Body() d:unknown){return this.service.approveLesson(r.user,p.id,p.sessionId,d);}
  @Post(':id/papers') @RequirePermissions('HOMEWORK_MANAGE','EXAM_CREATE') paper(@Req() r:any,@Param('id') id:string,@Body() d:unknown){return this.service.generatePaper(r.user,id,d);}
  @Patch(':id/papers/:paperId/review') @RequirePermissions('HOMEWORK_MANAGE','EXAM_UPDATE') reviewPaper(@Req() r:any,@Param() p:any,@Body() d:unknown){return this.service.reviewPaper(r.user,p.id,p.paperId,d);}
  @Post(':id/papers/:paperId/publish') @RequirePermissions('HOMEWORK_MANAGE','EXAM_UPDATE') publishPaper(@Req() r:any,@Param() p:any,@Body() d:unknown){return this.service.publishPaper(r.user,p.id,p.paperId,d);}
  @Post(':id/papers/:paperId/marks') @RequirePermissions('MARKS_UPDATE') marks(@Req() r:any,@Param() p:any,@Body() d:unknown){return this.service.marks(r.user,p.id,p.paperId,d);}
  @Get(':id/evidence') @RequirePermissions('REPORT_VIEW') evidence(@Req() r:any,@Param('id') id:string){return this.service.evidence(r.user,id);}
  @Post(':id/interventions') @RequirePermissions('LESSON_PLAN_MANAGE','REPORT_VIEW') intervention(@Req() r:any,@Param('id') id:string,@Body() d:unknown){return this.service.intervention(r.user,id,d);}
  @Patch(':id/interventions/:interventionId') @RequirePermissions('LESSON_PLAN_MANAGE','REPORT_VIEW') close(@Req() r:any,@Param() p:any,@Body() d:unknown){return this.service.closeIntervention(r.user,p.id,p.interventionId,d);}
  @Post(':id/insights') @RequirePermissions('REPORT_VIEW','COMMUNICATION_MANAGE') insight(@Req() r:any,@Param('id') id:string,@Body() d:unknown){return this.service.insight(r.user,id,d);}
  @Patch(':id/insights/:insightId/review') @RequirePermissions('COMMUNICATION_MANAGE') reviewInsight(@Req() r:any,@Param() p:any,@Body() d:unknown){return this.service.reviewInsight(r.user,p.id,p.insightId,d);}
  @Post(':id/insights/:insightId/publish') @RequirePermissions('COMMUNICATION_MANAGE') publishInsight(@Req() r:any,@Param() p:any,@Body() d:unknown){return this.service.publishInsight(r.user,p.id,p.insightId,d);}
}

@Controller('parent') @UseGuards(JwtAuthGuard)
export class ParentInsightsController {
  constructor(private readonly service:WorkflowService){}
  @Get('enrollments/:id/academic-insights') insights(@Req() r:any,@Param('id') id:string){return this.service.parentInsights(r.user,id);}
}
