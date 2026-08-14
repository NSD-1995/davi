import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'davi-super-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService, JwtAuthGuard, RolesGuard],
  exports: [AcademicYearsService],
})
export class AcademicYearsModule {}
