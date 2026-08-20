import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'davi-super-secret-key', signOptions: { expiresIn: '7d' } })],
  controllers: [UsersController],
  providers: [UsersService, JwtAuthGuard, PermissionsGuard],
  exports: [UsersService],
})
export class UsersModule {}
