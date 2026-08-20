import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { SchoolsModule } from './schools/schools.module';
import { UsersModule } from './users/users.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { ParentsModule } from './parents/parents.module';
import { SchoolSettingsModule } from './school-settings/school-settings.module';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { SchoolClassesModule } from './classes/classes.module';
import { SectionsModule } from './sections/sections.module';
import { SubjectsModule } from './subjects/subjects.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { StaffModule } from './staff/staff.module';
import { AttendanceModule } from './attendance/attendance.module';
import { TimetableModule } from './timetable/timetable.module';
import { ExamsModule } from './exams/exams.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SchoolsModule,
    UsersModule,
    StudentsModule,
    TeachersModule,
    ParentsModule,
    SchoolSettingsModule,
    AcademicYearsModule,
    SchoolClassesModule,
    SectionsModule,
    SubjectsModule,
    RolesModule,
    PermissionsModule,
    StaffModule,
    AttendanceModule,
    TimetableModule,
    ExamsModule,
    EventsModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
