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
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SectionsService } from './sections.service';
import { CreateSectionDto, UpdateSectionDto } from './sections.dto';

@Controller('sections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Post()
  @RequirePermissions('SECTION_CREATE')
  create(@Req() req: any, @Body() dto: CreateSectionDto) {
    return this.sectionsService.create(req.user.schoolId, dto);
  }

  @Get()
  @RequirePermissions('SECTION_VIEW')
  findAll(@Req() req: any) {
    return this.sectionsService.findAll(req.user.schoolId);
  }

  @Get(':id')
  @RequirePermissions('SECTION_VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.sectionsService.findOne(id, req.user.schoolId);
  }

  @Get('schools/:schoolId')
  @RequirePermissions('SECTION_VIEW')
  findBySchool(@Req() req: any, @Param('schoolId') schoolId: string) {
    return this.sectionsService.findBySchool(schoolId, req.user.schoolId);
  }

  @Get('classes/:classId')
  @RequirePermissions('SECTION_VIEW')
  findByClass(@Req() req: any, @Param('classId') classId: string) {
    return this.sectionsService.findByClass(classId, req.user.schoolId);
  }

  @Patch(':id')
  @RequirePermissions('SECTION_UPDATE')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions('SECTION_DELETE')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.sectionsService.remove(id, req.user.schoolId);
  }
}
