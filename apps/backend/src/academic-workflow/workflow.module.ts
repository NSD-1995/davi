import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AiModule } from '../ai/ai.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { WorkflowService } from './workflow.service';
import { WorkflowController, ParentInsightsController } from './workflow.controller';

@Module({imports:[AiModule,JwtModule.register({secret:process.env.JWT_SECRET||'davi-super-secret-key'})],controllers:[WorkflowController,ParentInsightsController],providers:[WorkflowService,JwtAuthGuard,PermissionsGuard]})
export class WorkflowModule {}
