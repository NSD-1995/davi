import {DashboardCommandService} from './dashboard-command.service';
import {AttendanceModule} from '../attendance/attendance.module';
import {TimetableModule} from '../timetable/timetable.module';
import{Module}from'@nestjs/common';import{JwtModule}from'@nestjs/jwt';import{JwtAuthGuard}from'../auth/jwt-auth.guard';import{PermissionsGuard}from'../auth/permissions.guard';import{DashboardController}from'./dashboard.controller';import{DashboardService}from'./dashboard.service';@Module({imports:[AttendanceModule,TimetableModule,JwtModule.register({secret:process.env.JWT_SECRET||'davi-super-secret-key',signOptions:{expiresIn:'7d'}})],controllers:[DashboardController],providers:[DashboardCommandService,DashboardService,JwtAuthGuard,PermissionsGuard]})export class DashboardModule{}
