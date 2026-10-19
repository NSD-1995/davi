import { StudentIntakeService } from './student-intake.service';
import { AdmissionsSchoolGuard } from './admissions-school.guard';
import { AdmissionsCrmController } from './admissions-crm.controller';
import { AdmissionsCrmService } from './admissions-crm.service';
import { AdmissionsDocumentsService } from './admissions-documents.service';
import { EnrollmentAllocationController } from './enrollment-allocation.controller';
import { EnrollmentAllocationService } from './enrollment-allocation.service';
import { Module } from '@nestjs/common'; import { JwtModule } from '@nestjs/jwt'; import { PrismaModule } from '../prisma/prisma.module'; import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { PermissionsGuard } from '../auth/permissions.guard'; import { StudentAdmissionsController } from './student-admissions.controller'; import { StudentAdmissionsService } from './student-admissions.service'; @Module({ imports: [PrismaModule, JwtModule.register({ secret: process.env.JWT_SECRET || 'davi-super-secret-key', signOptions: { expiresIn: '7d' } })], controllers: [StudentAdmissionsController, AdmissionsCrmController, EnrollmentAllocationController], providers: [StudentIntakeService, AdmissionsSchoolGuard, AdmissionsCrmService, AdmissionsDocumentsService, EnrollmentAllocationService, StudentAdmissionsService, JwtAuthGuard, PermissionsGuard], exports: [StudentAdmissionsService, EnrollmentAllocationService] }) export class StudentAdmissionsModule {}
