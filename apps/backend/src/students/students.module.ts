import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'davi-super-secret-key', signOptions: { expiresIn: '7d' } })],
  controllers: [StudentsController],
  providers: [StudentsService, JwtAuthGuard, PermissionsGuard],
  exports: [StudentsService],
})
export class StudentsModule {}
