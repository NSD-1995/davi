import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ClassroomManagementController } from './classroom-management.controller';
import { ClassroomManagementService } from './classroom-management.service';
@Module({imports:[PrismaModule,JwtModule.register({secret:process.env.JWT_SECRET||'davi-super-secret-key',signOptions:{expiresIn:'7d'}})],controllers:[ClassroomManagementController],providers:[ClassroomManagementService,JwtAuthGuard,PermissionsGuard]})
export class ClassroomManagementModule {}
