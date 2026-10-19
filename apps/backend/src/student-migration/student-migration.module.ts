import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdmissionsSchoolGuard } from '../student-admissions/admissions-school.guard';
import { StudentAdmissionsModule } from '../student-admissions/student-admissions.module';
import { StudentsModule } from '../students/students.module';
import { MigrationScanner } from './migration-scanner';
import { MigrationExtractor } from './migration-extractor';
import { StudentMigrationService } from './student-migration.service';
import { StudentMigrationController, MigrationPrivateResponseInterceptor } from './student-migration.controller';
import { StudentMigrationWorker } from './student-migration.worker';
@Module({imports:[PrismaModule,StudentAdmissionsModule,StudentsModule,JwtModule.register({secret:process.env.JWT_SECRET || 'davi-super-secret-key'})],controllers:[StudentMigrationController],providers:[MigrationPrivateResponseInterceptor,JwtAuthGuard,AdmissionsSchoolGuard,MigrationScanner,MigrationExtractor,StudentMigrationService,StudentMigrationWorker]})
export class StudentMigrationModule{}
