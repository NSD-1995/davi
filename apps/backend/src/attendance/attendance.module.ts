import {StaffPunchService} from './staff-punch.service';
import {LeaveBalanceService} from './leave-balance.service';
import {SchoolOperationsService} from './school-operations.service';
import {SchoolOperationsController} from './school-operations.controller';
import {StaffAttendanceService} from './staff-attendance.service';
import {TimetableModule} from '../timetable/timetable.module';
import { Module } from '@nestjs/common'; import { JwtModule } from '@nestjs/jwt'; import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { PermissionsGuard } from '../auth/permissions.guard'; import { AttendanceController } from './attendance.controller'; import { AttendanceService } from './attendance.service';
@Module({ imports: [TimetableModule,JwtModule.register({ secret: process.env.JWT_SECRET || 'davi-super-secret-key', signOptions: { expiresIn: '7d' } })], controllers: [SchoolOperationsController,AttendanceController], providers: [StaffPunchService,LeaveBalanceService,SchoolOperationsService,StaffAttendanceService,AttendanceService, JwtAuthGuard, PermissionsGuard], exports: [AttendanceService] }) export class AttendanceModule {}
