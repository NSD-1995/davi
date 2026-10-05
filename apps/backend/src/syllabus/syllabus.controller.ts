import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { SyllabusService } from './syllabus.service';
import { ReviewSyllabusDto, UploadSyllabusDto } from './syllabus.dto';

@Controller('syllabi') @UseGuards(JwtAuthGuard,PermissionsGuard)
export class SyllabusController {
  constructor(private readonly service:SyllabusService) {}
  @Get('terms') @RequirePermissions('SUBJECT_VIEW') terms(@Req() r:any,@Query('academicYearId') y:string){return this.service.terms(r.user,y);}
  @Post('terms') @RequirePermissions('ACADEMIC_YEAR_UPDATE') createTerm(@Req() r:any,@Body() d:{academicYearId:string;name:string}){return this.service.createTerm(r.user,d.academicYearId,d.name);}
  @Post('upload') @RequirePermissions('LESSON_PLAN_MANAGE') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024}})) upload(@Req() r:any,@Body() d:UploadSyllabusDto,@UploadedFile() f:any){return this.service.upload(r.user,d,f);}
  @Get() @RequirePermissions('LESSON_PLAN_VIEW') list(@Req() r:any,@Query() q:any){return this.service.list(r.user,q);}
  @Get('topics') @RequirePermissions('LESSON_PLAN_VIEW') topics(@Req() r:any,@Query() q:any){return this.service.topics(r.user,q);}
  @Get(':id') @RequirePermissions('LESSON_PLAN_VIEW') get(@Req() r:any,@Param('id') id:string){return this.service.get(r.user,id);}
  @Patch(':id/review') @RequirePermissions('LESSON_PLAN_MANAGE') review(@Req() r:any,@Param('id') id:string,@Body() d:ReviewSyllabusDto){return this.service.review(r.user,id,d);}
  @Post(':id/approve') @RequirePermissions('LESSON_PLAN_MANAGE') approve(@Req() r:any,@Param('id') id:string){return this.service.approve(r.user,id);}
  @Delete(':id') @RequirePermissions('LESSON_PLAN_MANAGE') discard(@Req() r:any,@Param('id') id:string){return this.service.discard(r.user,id);}
}
