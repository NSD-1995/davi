import { Module } from '@nestjs/common';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'davi-super-secret-key', signOptions: { expiresIn: '7d' } })],
  controllers: [ParentsController],
  providers: [ParentsService, JwtAuthGuard, PermissionsGuard],
  exports: [ParentsService],
})
export class ParentsModule {}
