import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MigrationScanner } from '../student-migration/migration-scanner';
import { LocalMediaStorage,MediaStorage } from './media-storage';
import { SchoolExperienceService } from './school-experience.service';
import { SchoolExperienceController } from './school-experience.controller';
@Module({imports:[PrismaModule,JwtModule.register({secret:process.env.JWT_SECRET||'davi-super-secret-key'})],controllers:[SchoolExperienceController],providers:[JwtAuthGuard,MigrationScanner,LocalMediaStorage,MediaStorage,SchoolExperienceService]})
export class SchoolExperienceModule {}
