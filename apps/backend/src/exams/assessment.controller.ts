import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssessmentService } from './assessment.service';
import { assessmentPdf } from './assessment-pdf';
import { AssessmentAiService } from './assessment-ai.service';

@Controller('assessments') @UseGuards(JwtAuthGuard)
export class AssessmentController {
 constructor(private readonly service:AssessmentService,private readonly ai:AssessmentAiService){}
 @Get('ai/policy') aiPolicy(@Req()r:any){return this.ai.policy(r.user);}
 @Post('ai/policy') saveAiPolicy(@Req()r:any,@Body()d:unknown){return this.ai.savePolicy(r.user,d);}
 @Post(':id/ai') generate(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.ai.generate(r.user,id,d);}
 @Post(':id/ai/:generationId/review') reviewAi(@Req()r:any,@Param('id')id:string,@Param('generationId')g:string,@Body()d:unknown){return this.ai.review(r.user,id,g,d);}
 @Get('patterns') patterns(@Req()r:any,@Query()q:any){return this.service.patterns(r.user,q);}
 @Post('patterns') pattern(@Req()r:any,@Body()d:unknown){return this.service.savePattern(r.user,d);}
 @Get() list(@Req()r:any,@Query()q:any){return this.service.list(r.user,q);}
 @Get('terms') terms(@Req()r:any,@Query()q:any){return this.service.terms(r.user,q);}
 @Post('terms/open') openTerm(@Req()r:any,@Body()d:unknown){return this.service.openTerm(r.user,d);}
 @Post() create(@Req()r:any,@Body()d:unknown){return this.service.create(r.user,d);}
 @Get('parent/:enrollmentId') parent(@Req()r:any,@Param('enrollmentId')id:string){return this.service.parentReports(r.user,id);}
 @Get('parent/reports/:reportId/pdf') async parentPdf(@Req()r:any,@Param('reportId')id:string,@Res()res:any){const report=await this.service.report(r.user,id,true);return this.pdf(res,report);}
 @Get('reports/:reportId/pdf') async report(@Req()r:any,@Param('reportId')id:string,@Res()res:any){const report=await this.service.report(r.user,id);return this.pdf(res,report);}
 @Get(':id/consolidated') consolidated(@Req()r:any,@Param('id')id:string){return this.service.consolidated(r.user,id);}
 @Get(':id') detail(@Req()r:any,@Param('id')id:string){return this.service.detail(r.user,id);}
 @Get(':id/observations') observationHistory(@Req()r:any,@Param('id')id:string,@Query()q:any){return this.service.observationHistory(r.user,id,q);}
 @Post(':id/marks/preview') preview(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.service.marks(r.user,id,d,true);}
 @Post(':id/marks') marks(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.service.marks(r.user,id,d);}
 @Post(':id/sheet') sheet(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.service.sheet(r.user,id,d);}
 @Post(':id/observations') observations(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.service.observations(r.user,id,d);}
 @Post(':id/transition') transition(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.service.transition(r.user,id,d);}
 @Post(':id/schedule') schedule(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.service.schedule(r.user,id,d);}
 private async pdf(res:any,report:any){res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="DAVI-report-${report.id}.pdf"`);res.send(await assessmentPdf(report.snapshot));}
}
