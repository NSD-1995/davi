import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { DashboardService } from './dashboard.service';
import { DashboardCommandService } from './dashboard-command.service';
@Controller('dashboard') @UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
 constructor(private readonly service:DashboardService,private readonly command:DashboardCommandService){}
 @Get('me') myDashboard(@Req()request:any){return this.service.myDashboard(request.user.id,request.user.schoolId);}
 @Get('summary') @RequirePermissions('DASHBOARD_VIEW') summary(@Req()request:any){return this.service.summary(request.user.schoolId);}
 @Get('command-center') @RequirePermissions('DASHBOARD_VIEW') commandCenter(@Req()request:any,@Query('academicYearId')yearId?:string){return this.command.get(request.user.schoolId,request.user.id,yearId);}
}
