import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SchoolSettingsController } from './school-settings.controller';
import { SchoolSettingsService } from './school-settings.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [PrismaModule, JwtModule.register({ secret: process.env.JWT_SECRET || 'davi-super-secret-key', signOptions: { expiresIn: '7d' } })],
  controllers: [SchoolSettingsController],
  providers: [SchoolSettingsService, JwtAuthGuard, PermissionsGuard],
  exports: [SchoolSettingsService],
})
export class SchoolSettingsModule {}
