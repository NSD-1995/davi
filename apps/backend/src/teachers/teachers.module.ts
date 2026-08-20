import { Module } from '@nestjs/common';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'davi-super-secret-key', signOptions: { expiresIn: '7d' } })],
  controllers: [TeachersController],
  providers: [TeachersService, JwtAuthGuard, PermissionsGuard],
  exports: [TeachersService],
})
export class TeachersModule {}
