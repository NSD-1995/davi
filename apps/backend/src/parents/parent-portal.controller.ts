import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParentsService } from './parents.service';

@Controller('parent')
@UseGuards(JwtAuthGuard)
export class ParentPortalController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('me/children')
  children(@Req() req: any) {
    return this.parentsService.findMyStudents(req.user.id);
  }

  @Get('enrollments/:enrollmentId/dashboard')
  dashboard(@Req() req: any, @Param('enrollmentId') enrollmentId: string) {
    return this.parentsService.enrollmentDashboard(req.user.id, enrollmentId);
  }

  @Get('enrollments/:enrollmentId/attendance')
  attendance(@Req() req: any, @Param('enrollmentId') enrollmentId: string) {
    return this.parentsService.enrollmentAttendance(req.user.id, enrollmentId);
  }
}
