import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { SchoolSettingsService } from './school-settings.service';
import { CreateSchoolSettingDto, UpdateSchoolSettingDto } from './school-settings.dto';

@Controller('school-settings')
export class SchoolSettingsController {
  constructor(private readonly schoolSettingsService: SchoolSettingsService) {}

  @Post()
  create(@Body() dto: CreateSchoolSettingDto) {
    return this.schoolSettingsService.create(dto);
  }

  @Get()
  findAll() {
    return this.schoolSettingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolSettingsService.findOne(id);
  }

  @Get('schools/:schoolId')
  findBySchoolId(@Param('schoolId') schoolId: string) {
    return this.schoolSettingsService.findBySchoolId(schoolId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSchoolSettingDto) {
    return this.schoolSettingsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schoolSettingsService.remove(id);
  }
}
