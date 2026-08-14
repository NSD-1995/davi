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
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './academic-years.dto';

@Controller('academic-years')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles('school-admin')
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateAcademicYearDto) {
    return this.academicYearsService.create(req.user.schoolId, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.academicYearsService.findAll(req.user.schoolId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.academicYearsService.findOne(id, req.user.schoolId);
  }

  @Get('schools/:schoolId')
  findBySchool(@Req() req: any, @Param('schoolId') schoolId: string) {
    return this.academicYearsService.findBySchool(schoolId, req.user.schoolId);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAcademicYearDto) {
    return this.academicYearsService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.academicYearsService.remove(id, req.user.schoolId);
  }
}
