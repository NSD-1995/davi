import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TeachersService } from './teachers.service';
import { CreateTeacherAssignmentDto, CreateTeacherDto, UpdateTeacherDto } from './teachers.dto';

@Controller('teachers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @RequirePermissions('STAFF_CREATE')
  create(@Req() req: any, @Body() dto: CreateTeacherDto) {
    return this.teachersService.create(req.user.schoolId, dto);
  }

  @Get()
  @RequirePermissions('STAFF_VIEW')
  findAll(@Req() req: any) {
    return this.teachersService.findAll(req.user.schoolId);
  }

  @Get('class-teacher-options')
  @RequirePermissions('STAFF_VIEW')
  options(@Req()req:any,@Query('academicYearId')year:string){return this.teachersService.classTeacherOptions(req.user.schoolId,year);}

  @Get(':id')
  @RequirePermissions('STAFF_VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.teachersService.findOne(id, req.user.schoolId);
  }

  @Patch(':id')
  @RequirePermissions('STAFF_UPDATE')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachersService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions('STAFF_DELETE')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.teachersService.remove(id, req.user.schoolId);
  }

  @Put(':id/teaching-setup')
  @RequirePermissions('STAFF_UPDATE')
  teachingSetup(@Req()req:any,@Param('id')id:string,@Body()d:any){return this.teachersService.saveTeachingSetup(id,req.user.schoolId,d);}

  @Put(':id/eligibility')
  @RequirePermissions('STAFF_UPDATE')
  eligibility(@Req()req:any,@Param('id')id:string,@Body()d:any){return this.teachersService.saveEligibility(id,req.user.schoolId,d);}

  @Put(':id/capabilities')
  @RequirePermissions('STAFF_UPDATE')
  capabilities(@Req()req:any,@Param('id')id:string,@Body()d:any){return this.teachersService.saveCapabilities(id,req.user.schoolId,d.subjectIds);}

  @Post(':id/assignments')
  @RequirePermissions('STAFF_UPDATE')
  assign(@Req() req: any, @Param('id') id: string, @Body() dto: CreateTeacherAssignmentDto) {
    return this.teachersService.assignAcademics(id, req.user.schoolId, dto);
  }

  @Get(':id/assignments')
  @RequirePermissions('STAFF_VIEW')
  assignments(@Req() req: any, @Param('id') id: string) {
    return this.teachersService.findAssignments(id, req.user.schoolId);
  }

  @Delete(':id/subject-assignments/:assignmentId')
  @RequirePermissions('SUBJECT_TEACHER_MANAGE')
  removeSubjectAssignment(@Req()req:any,@Param('id')id:string,@Param('assignmentId')assignmentId:string){return this.teachersService.removeSubjectAssignment(id,assignmentId,req.user.schoolId);}

  @Delete(':id/assignments/:assignmentId')
  @RequirePermissions('STAFF_UPDATE')
  removeAssignment(@Req() req: any, @Param('id') id: string, @Param('assignmentId') assignmentId: string) {
    return this.teachersService.removeAssignment(id, assignmentId, req.user.schoolId);
  }
}
