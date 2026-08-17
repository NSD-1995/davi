import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto } from './subjects.dto';

@Controller('subjects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @RequirePermissions('SUBJECT_CREATE')
  create(@Req() req: any, @Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(req.user.schoolId, dto);
  }

  @Get()
  @RequirePermissions('SUBJECT_VIEW')
  findAll(@Req() req: any, @Query('status') status?: string) {
    return this.subjectsService.findAll(req.user.schoolId, status);
  }

  @Get('schools/:schoolId')
  @RequirePermissions('SUBJECT_VIEW')
  findBySchool(@Req() req: any, @Param('schoolId') schoolId: string, @Query('status') status?: string) {
    return this.subjectsService.findBySchool(schoolId, req.user.schoolId, status);
  }

  @Get(':id')
  @RequirePermissions('SUBJECT_VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.subjectsService.findOne(id, req.user.schoolId);
  }

  @Patch(':id')
  @RequirePermissions('SUBJECT_UPDATE')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectsService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions('SUBJECT_DELETE')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.subjectsService.remove(id, req.user.schoolId);
  }
}
