import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdmissionsSchoolGuard } from './admissions-school.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdmissionsCrmService } from './admissions-crm.service';
import { AdmissionsDocumentsService } from './admissions-documents.service';

@Controller('admissions')
@UseGuards(JwtAuthGuard, AdmissionsSchoolGuard)
export class AdmissionsCrmController {
  constructor(private readonly service: AdmissionsCrmService, private readonly documents: AdmissionsDocumentsService) {}
  @Get('lookups') @RequirePermissions('ADMISSIONS_VIEW') lookups(@Req() r: any) { return this.service.lookups(r.user.schoolId); }
  @Get('dashboard') @RequirePermissions('ADMISSIONS_VIEW') dashboard(@Req() r: any, @Query() q: any) { return this.service.dashboard(r.user.schoolId, q); }
  @Get('settings') @RequirePermissions('ADMISSIONS_VIEW') settings(@Req() r: any) { return this.service.settings(r.user.schoolId); }
  @Put('settings') @RequirePermissions('ADMISSIONS_SETTINGS_MANAGE') saveSettings(@Req() r: any, @Body() d: unknown) { return this.service.saveSettings(r.user.schoolId, r.user.id, d); }
  @Get('enquiries') @RequirePermissions('ADMISSIONS_VIEW') enquiries(@Req() r: any, @Query() q: any) { return this.service.list(r.user.schoolId, 'enquiries', q); }
  @Get('enquiries/:id') @RequirePermissions('ADMISSIONS_VIEW') enquiry(@Req() r: any, @Param('id') id: string) { return this.service.detail(r.user.schoolId, 'enquiries', id); }
  @Post('enquiries') @RequirePermissions('ADMISSIONS_MANAGE') createEnquiry(@Req() r: any, @Body() d: unknown) { return this.service.createEnquiry(r.user.schoolId, r.user.id, d); }
  @Post('enquiries/:id/followups') @RequirePermissions('ADMISSIONS_MANAGE') followup(@Req() r: any, @Param('id') id: string, @Body() d: unknown) { return this.service.followup(r.user.schoolId, r.user.id, id, d); }
  @Get('applications') @RequirePermissions('ADMISSIONS_VIEW') applications(@Req() r: any, @Query() q: any) { return this.service.list(r.user.schoolId, 'applications', q); }
  @Get('applications/:id') @RequirePermissions('ADMISSIONS_VIEW') application(@Req() r: any, @Param('id') id: string) { return this.service.detail(r.user.schoolId, 'applications', id); }
  @Post('applications') @RequirePermissions('ADMISSIONS_MANAGE') createApplication(@Req() r: any, @Body() d: unknown) { return this.service.createApplication(r.user.schoolId, r.user.id, d); }
  @Post('applications/:id/amendment') @RequirePermissions('ADMISSIONS_MANAGE') amendApplication(@Req() r: any, @Param('id') id: string, @Body() d: unknown) { return this.service.amendApplication(r.user.schoolId, r.user.id, id, d); }
  @Post('applications/:id/decision') @RequirePermissions('ADMISSIONS_DECIDE') decision(@Req() r: any, @Param('id') id: string, @Body() d: unknown) { return this.service.decision(r.user.schoolId, r.user.id, id, d); }
  @Post('applications/:id/confirm') @RequirePermissions('ADMISSIONS_JOIN') confirm(@Req() r:any,@Param('id') id:string,@Body() d:unknown){return this.service.confirmAdmission(r.user.schoolId,r.user.id,id,d);}
  @Post('applications/:id/joining') @RequirePermissions('ADMISSIONS_JOIN') join(@Req() r: any, @Param('id') id: string, @Body() d: unknown) { return this.service.join(r.user.schoolId, r.user.id, id, d); }
  @Post('applications/:id/payments') @RequirePermissions('ADMISSIONS_FEES_RECORD') payment(@Req() r: any, @Param('id') id: string, @Body() d: unknown) { return this.service.recordPayment(r.user.schoolId, r.user.id, id, d); }
  @Post('payments/:id/verification') @RequirePermissions('ADMISSIONS_FEES_VERIFY') verify(@Req() r: any, @Param('id') id: string, @Body() d: unknown) { return this.service.verifyPayment(r.user.schoolId, r.user.id, id, d); }
  @Post('applications/:id/waiver') @RequirePermissions('ADMISSIONS_FEES_VERIFY') waive(@Req() r: any, @Param('id') id: string, @Body() d: unknown) { return this.service.waive(r.user.schoolId, r.user.id, id, d); }
  @Post('applications/:id/documents') @RequirePermissions('ADMISSIONS_MANAGE')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  upload(@Req() r: any, @Param('id') id: string, @Body('kind') kind: unknown, @UploadedFile() file: any) { return this.documents.upload(r.user.schoolId, r.user.id, id, kind, file); }
  @Get('applications/:id/documents/:documentId') @RequirePermissions('ADMISSIONS_VIEW')
  async download(@Req() r: any, @Param('id') id: string, @Param('documentId') documentId: string, @Res() res: any) { const result = await this.documents.download(r.user.schoolId, id, documentId); res.setHeader('Content-Type', result.document.mimeType); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.document.name)}`); res.send(result.buffer); }
}
