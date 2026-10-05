import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AiModule } from '../ai/ai.module';
import { SyllabusController } from './syllabus.controller';
import { SyllabusService } from './syllabus.service';
@Module({
  imports:[AiModule,JwtModule.register({secret:process.env.JWT_SECRET||'davi-super-secret-key',signOptions:{expiresIn:'7d'}})],
  providers:[SyllabusService,JwtAuthGuard,PermissionsGuard],
  controllers:[SyllabusController],
})
export class SyllabusModule {}
