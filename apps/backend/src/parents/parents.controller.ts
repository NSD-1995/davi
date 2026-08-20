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
import { ParentsService } from './parents.service';
import { CreateParentDto, LinkParentStudentDto, OnboardParentDto, UpdateParentDto } from './parents.dto';

@Controller('parents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Post()
  @RequirePermissions('PARENT_CREATE')
  create(@Req() req: any, @Body() dto: CreateParentDto) {
    return this.parentsService.create(req.user.schoolId, dto);
  }

  @Get()
  @RequirePermissions('PARENT_VIEW')
  findAll(@Req() req: any) {
    return this.parentsService.findAll(req.user.schoolId);
  }

  @Get(':id')
  @RequirePermissions('PARENT_VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.parentsService.findOne(id, req.user.schoolId);
  }

  @Patch(':id')
  @RequirePermissions('PARENT_UPDATE')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateParentDto) {
    return this.parentsService.update(id, req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions('PARENT_UPDATE')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.parentsService.remove(id, req.user.schoolId);
  }

  @Post('onboard')
  @RequirePermissions('PARENT_CREATE')
  onboard(@Req() req: any, @Body() dto: OnboardParentDto) {
    return this.parentsService.onboard(req.user.schoolId, dto);
  }

  @Post(':id/students')
  @RequirePermissions('PARENT_UPDATE')
  linkStudent(@Req() req: any, @Param('id') id: string, @Body() dto: LinkParentStudentDto) {
    return this.parentsService.linkStudent(id, req.user.schoolId, dto);
  }

  @Delete(':id/students/:studentId')
  @RequirePermissions('PARENT_UPDATE')
  unlinkStudent(@Req() req: any, @Param('id') id: string, @Param('studentId') studentId: string) {
    return this.parentsService.unlinkStudent(id, studentId, req.user.schoolId);
  }

  @Get('me/students')
  myStudents(@Req() req: any) {
    return this.parentsService.findMyStudents(req.user.id, req.user.schoolId);
  }
}
