import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AcademicScopeService } from './academic-scope.service';
import { AiProviderService } from './ai-provider.service';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  imports:[JwtModule.register({secret:process.env.JWT_SECRET||'davi-super-secret-key',signOptions:{expiresIn:'7d'}})],
  providers:[AcademicScopeService,AiProviderService,AiService,JwtAuthGuard,PermissionsGuard],
  controllers:[AiController],
  exports:[AcademicScopeService,AiProviderService],
})
export class AiModule {}
