import {StaffPunchService} from './staff-punch.service';
import {BulkStaffAttendanceDto,AttendanceLockDto} from './school-operations.dto';
import {StaffAttendanceService} from './staff-attendance.service';
import { Body, Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common'; import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { RequirePermissions } from '../auth/permissions.decorator'; import { PermissionsGuard } from '../auth/permissions.guard'; import { MarkStaffAttendanceDto, MarkStudentAttendanceDto } from './attendance.dto'; import { AttendanceService } from './attendance.service';
@Controller('attendance') @UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController { constructor(private readonly service: AttendanceService,private readonly staffService:StaffAttendanceService,private readonly punches:StaffPunchService) {}
  @Post('students') @RequirePermissions('ATTENDANCE_MARK') markStudents(@Req() req: any, @Body() dto: MarkStudentAttendanceDto) { return this.service.markStudents(req.user.schoolId, req.user.id, dto); }
  @Get('students') @RequirePermissions('ATTENDANCE_VIEW') students(@Req() req: any, @Query('date') date?: string, @Query('classId') classId?: string, @Query('sectionId') sectionId?: string, @Query('from') from?: string, @Query('to') to?: string) { return this.service.listStudents(req.user.schoolId, date, classId, sectionId, from, to); }
  @Get('staff/self-policy') selfPolicy(@Req()r:any){return this.punches.own(r.user.schoolId,r.user.id);}
  @Get('staff/exceptions') exceptions(@Req()r:any,@Query('manage')manage:string){return this.punches.exceptions(r.user.schoolId,r.user.id,manage==='true');}
  @Post('staff/exceptions') requestException(@Req()r:any,@Body()d:any){return this.punches.requestException(r.user.schoolId,r.user.id,d);}
  @Post('staff/exceptions/:id/decision') decideException(@Req()r:any,@Param('id')id:string,@Body()d:any){return this.punches.decideException(r.user.schoolId,r.user.id,id,d);}
  @Get('staff/roster') roster(@Req()r:any,@Query('date')date:string){return this.staffService.roster(r.user.schoolId,r.user.id,date);}
  @Post('staff/bulk') bulk(@Req()r:any,@Body()d:BulkStaffAttendanceDto){return this.staffService.bulk(r.user.schoolId,r.user.id,d);}
  @Post('staff/lock') lock(@Req()r:any,@Body()d:AttendanceLockDto){return this.staffService.lock(r.user.schoolId,r.user.id,d);}
  @Get('staff/history') history(@Req()r:any,@Query()q:any){return this.staffService.history(r.user.schoolId,r.user.id,q.staffId,q.from,q.to);}
  @Get('staff/check-in') own(@Req()req:any){return this.service.ownAttendance(req.user.schoolId,req.user.id);}
  @Post('staff/check-out') checkOut(@Req()req:any,@Body()d:any){return this.service.selfCheckOut(req.user.schoolId,req.user.id,new Date(),d);}
  @Post('staff/check-in') checkIn(@Req()req:any,@Body()d:any){return this.service.selfCheckIn(req.user.schoolId,req.user.id,new Date(),d);}
  @Post('staff') markStaff(@Req() req: any, @Body() dto: MarkStaffAttendanceDto) { return this.service.markStaff(req.user.schoolId, req.user.id, dto); }
  @Get('staff') staff(@Req() req: any, @Query('date') date?: string) { return this.service.listStaff(req.user.schoolId, date,req.user.id); }
}
