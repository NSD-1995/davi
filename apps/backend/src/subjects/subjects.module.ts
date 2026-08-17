import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'davi-super-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [SubjectsController],
  providers: [SubjectsService, JwtAuthGuard, PermissionsGuard],
  exports: [SubjectsService],
})
export class SubjectsModule {}
