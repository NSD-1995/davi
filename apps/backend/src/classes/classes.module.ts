import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { SchoolClassesController } from './classes.controller';
import { SchoolClassesService } from './classes.service';

@Module({
  imports: [PrismaModule, JwtModule.register({ secret: process.env.JWT_SECRET || 'davi-super-secret-key', signOptions: { expiresIn: '7d' } })],
  controllers: [SchoolClassesController],
  providers: [SchoolClassesService, JwtAuthGuard, PermissionsGuard],
  exports: [SchoolClassesService],
})
export class SchoolClassesModule {}
