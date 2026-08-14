import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SectionsService } from './sections.service';
import { CreateSectionDto, UpdateSectionDto } from './sections.dto';

@Controller('sections')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles('school-admin')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateSectionDto) {
    return this.sectionsService.create(req.user.schoolId, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.sectionsService.findAll(req.user.schoolId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.sectionsService.findOne(id, req.user.schoolId);
  }

  @Get('schools/:schoolId')
  findBySchool(@Req() req: any, @Param('schoolId') schoolId: string) {
    return this.sectionsService.findBySchool(schoolId, req.user.schoolId);
  }

  @Get('classes/:classId')
  findByClass(@Req() req: any, @Param('classId') classId: string) {
    return this.sectionsService.findByClass(classId, req.user.schoolId);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.sectionsService.remove(id, req.user.schoolId);
  }
}
