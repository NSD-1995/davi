import { StudentIntakeService } from './student-intake.service';
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdmissionsSchoolGuard } from './admissions-school.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { EnrollmentAllocationService } from './enrollment-allocation.service';
@Controller('enrollment-planning') @UseGuards(JwtAuthGuard, AdmissionsSchoolGuard)
export class EnrollmentAllocationController {
  constructor(private readonly service: EnrollmentAllocationService, private readonly intake: StudentIntakeService) {}
  @Post('intake-preview') @RequirePermissions('ADMISSIONS_MANAGE') intakePreview(@Req() r:any,@Body() d:unknown){return this.intake.preview(r.user.schoolId,d);}
  @Post('intake-confirm') @RequirePermissions('ADMISSIONS_MANAGE') intakeConfirm(@Req() r:any,@Body() d:unknown){return this.intake.confirm(r.user.schoolId,r.user.id,d);}
  @Get('lookups') @RequirePermissions('STUDENT_VIEW') lookups(@Req() r: any) { return this.service.lookups(r.user.schoolId); }
  @Get() @RequirePermissions('STUDENT_VIEW') list(@Req() r: any, @Query() q: unknown) { return this.service.list(r.user.schoolId, q); }
  @Post('suggest') @RequirePermissions('ENROLLMENT_ALLOCATE') suggest(@Req() r:any,@Body() d:unknown){return this.service.suggest(r.user.schoolId,d);}
  @Post('preview') @RequirePermissions('ENROLLMENT_ALLOCATE') preview(@Req() r: any, @Body() d: unknown) { return this.service.preview(r.user.schoolId, d); }
  @Post('confirm') @RequirePermissions('ENROLLMENT_ALLOCATE') confirm(@Req() r: any, @Body() d: unknown) { return this.service.confirm(r.user.schoolId, r.user.id, d); }
  @Post('moves') @RequirePermissions('ENROLLMENT_MOVE') move(@Req() r: any, @Body() d: unknown) { return this.service.move(r.user.schoolId, r.user.id, d); }
  @Post('promotions') @RequirePermissions('ENROLLMENT_PROMOTE') promote(@Req() r: any, @Body() d: unknown) { return this.service.promote(r.user.schoolId, r.user.id, d); }
  @Post('capacity-policy') @RequirePermissions('SECTION_UPDATE') capacityPolicy(@Req() r:any,@Body() d:unknown){return this.service.saveCapacityPolicy(r.user.schoolId,r.user.id,d);}
  @Get(':id/history') @RequirePermissions('STUDENT_VIEW') history(@Req() r: any, @Param('id') id: string) { return this.service.history(r.user.schoolId, id); }
}
