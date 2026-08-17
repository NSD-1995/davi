import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'davi-super-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [SchoolsController],
  providers: [SchoolsService, JwtAuthGuard, RolesGuard, PermissionsGuard],
  exports: [SchoolsService],
})
export class SchoolsModule {}
