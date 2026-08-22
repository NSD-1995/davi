import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'; import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { RequirePermissions } from '../auth/permissions.decorator'; import { PermissionsGuard } from '../auth/permissions.guard'; import { MarkStaffAttendanceDto, MarkStudentAttendanceDto } from './attendance.dto'; import { AttendanceService } from './attendance.service';
@Controller('attendance') @UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController { constructor(private readonly service: AttendanceService) {}
  @Post('students') @RequirePermissions('ATTENDANCE_MARK') markStudents(@Req() req: any, @Body() dto: MarkStudentAttendanceDto) { return this.service.markStudents(req.user.schoolId, req.user.id, dto); }
  @Get('students') @RequirePermissions('ATTENDANCE_VIEW') students(@Req() req: any, @Query('date') date?: string, @Query('classId') classId?: string, @Query('sectionId') sectionId?: string, @Query('from') from?: string, @Query('to') to?: string) { return this.service.listStudents(req.user.schoolId, date, classId, sectionId, from, to); }
  @Post('staff') @RequirePermissions('ATTENDANCE_MARK') markStaff(@Req() req: any, @Body() dto: MarkStaffAttendanceDto) { return this.service.markStaff(req.user.schoolId, req.user.id, dto); }
  @Get('staff') @RequirePermissions('ATTENDANCE_VIEW') staff(@Req() req: any, @Query('date') date?: string) { return this.service.listStaff(req.user.schoolId, date); }
}
