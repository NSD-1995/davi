import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Body, Controller, Get, Param, Patch, Post, Put, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdmissionsSchoolGuard } from '../student-admissions/admissions-school.guard';
import { StudentMigrationService } from './student-migration.service';
import { MigrationExtractor } from './migration-extractor';
import { csvCell } from './migration-rules';
@Injectable()
export class MigrationPrivateResponseInterceptor implements NestInterceptor {intercept(context:ExecutionContext,next:CallHandler){const response=context.switchToHttp().getResponse();response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');return next.handle();}}
@Controller('student-migrations') @UseInterceptors(MigrationPrivateResponseInterceptor) @UseGuards(JwtAuthGuard,AdmissionsSchoolGuard)
export class StudentMigrationController {
 constructor(private readonly service:StudentMigrationService,private readonly extractor:MigrationExtractor){}
 @Get('lookups') @RequirePermissions('students.import.view') lookups(@Req() r:any){return this.service.lookups(r.user.schoolId);}
 @Get('capabilities') @RequirePermissions('students.import.view') capabilities(){return {scannerConfigured:Boolean(process.env.MIGRATION_CLAMD_HOST),localOcrConfigured:Boolean(process.env.MIGRATION_OCR_LANG_PATH),cloudAiEnabled:false};}
 @Get('usage') @RequirePermissions('students.import.view') usage(@Req() r:any,@Query('academicYearId') year?:string){return this.service.usage(r.user.schoolId,year);}
 @Get('policy') @RequirePermissions('students.import.view') policy(@Req() r:any){return this.service.policy(r.user.schoolId);}
 @Put('policy') @RequirePermissions('students.import.manage') savePolicy(@Req() r:any,@Body() body:unknown){return this.service.savePolicy(r.user.schoolId,r.user.id,body);}
 @Get('template') @RequirePermissions('students.import.view') async template(@Res() response:any){response.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');response.setHeader('Content-Disposition','attachment; filename="DAVI-student-migration.xlsx"');response.setHeader('Cache-Control','no-store');response.send(await this.extractor.workbookTemplate());}
 @Get() @RequirePermissions('students.import.view') list(@Req() r:any,@Query('academicYearId') year?:string){return this.service.list(r.user.schoolId,year);}
 @Post() @RequirePermissions('students.import.manage') create(@Req() r:any,@Body() body:unknown){return this.service.create(r.user.schoolId,r.user.id,body);}
 @Get(':id') @RequirePermissions('students.import.view') detail(@Req() r:any,@Param('id') id:string){return this.service.detail(r.user.schoolId,id);}
 @Post(':id/files') @RequirePermissions('students.import.manage') @UseInterceptors(FilesInterceptor('files',10,{limits:{fileSize:20*1024*1024,files:10}})) upload(@Req() r:any,@Param('id') id:string,@UploadedFiles() files:any[]){return this.service.upload(r.user.schoolId,r.user.id,id,files);}
 @Post(':id/extract') @RequirePermissions('students.import.manage') extract(@Req() r:any,@Param('id') id:string,@Body() body:unknown){return this.service.queueExtraction(r.user.schoolId,r.user.id,id,body);}
 @Get(':id/files/:fileId/source') @RequirePermissions('students.import.view') async source(@Req() r:any,@Param('id') id:string,@Param('fileId') fileId:string,@Res() response:any){const file=await this.service.downloadSource(r.user.schoolId,id,fileId);response.setHeader('Content-Type',file.mimeType);response.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(file.name));response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.send(file.buffer);}
 @Get(':id/rows') @RequirePermissions('students.import.view') rows(@Req() r:any,@Param('id') id:string,@Query() query:unknown){return this.service.rows(r.user.schoolId,id,query);}
 @Put(':id/mapping') @RequirePermissions('students.import.manage') mapping(@Req() r:any,@Param('id') id:string,@Body() body:unknown){return this.service.applyMapping(r.user.schoolId,r.user.id,id,body);}
 @Patch(':id/rows/:rowId') @RequirePermissions('students.import.manage') edit(@Req() r:any,@Param('id') id:string,@Param('rowId') rowId:string,@Body() body:unknown){return this.service.editRow(r.user.schoolId,r.user.id,id,rowId,body);}
 @Post(':id/validate') @RequirePermissions('students.import.manage') validate(@Req() r:any,@Param('id') id:string,@Body() body:unknown){return this.service.validate(r.user.schoolId,r.user.id,id,body);}
 @Get(':id/allocation') @RequirePermissions('students.import.view') allocation(@Req() r:any,@Param('id') id:string){return this.service.allocationPreview(r.user.schoolId,id);}
 @Post(':id/sections') @RequirePermissions('students.import.manage') sections(@Req() r:any,@Param('id') id:string,@Body() body:unknown){return this.service.approveSections(r.user.schoolId,r.user.id,id,body);}
 @Post(':id/commit') @RequirePermissions('students.import.commit') commit(@Req() r:any,@Param('id') id:string,@Body() body:unknown){return this.service.approveCommit(r.user.schoolId,r.user.id,id,body);}
 @Get(':id/rollback-impact') @RequirePermissions('students.import.rollback') rollbackImpact(@Req() r:any,@Param('id') id:string){return this.service.rollbackImpact(r.user.schoolId,id);}
 @Post(':id/rollback') @RequirePermissions('students.import.rollback') rollback(@Req() r:any,@Param('id') id:string,@Body() body:unknown){return this.service.rollback(r.user.schoolId,r.user.id,id,body);}
 @Get(':id/error-report') @RequirePermissions('students.import.view') async report(@Req() r:any,@Param('id') id:string,@Res() response:any){const rows=await this.service.errorRows(r.user.schoolId,id);const text=[['Source','Page','Admission number','Status','Issues'].map(csvCell).join(','),...rows.map((row:any)=>[row.sourceRef,row.page,row.values.admissionNumber,row.status,row.issues.join(' | ')].map(csvCell).join(','))].join('\r\n');response.setHeader('Content-Type','text/csv; charset=utf-8');response.setHeader('Content-Disposition','attachment; filename="DAVI-import-errors.csv"');response.setHeader('Cache-Control','no-store');response.send('\uFEFF'+text);}
}
