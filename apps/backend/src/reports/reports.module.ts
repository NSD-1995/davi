import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsAccess } from './analytics-access';
import { AnalyticsCache } from './analytics-cache';
import { AnalyticsAttention } from './analytics-attention';
import { AnalyticsExports } from './analytics-exports';
import { AnalyticsInsights } from './analytics-insights';
import { OperationsAccessService } from '../auth/operations-access.service';
import { AiModule } from '../ai/ai.module';
import{Module}from'@nestjs/common';import{JwtModule}from'@nestjs/jwt';import{JwtAuthGuard}from'../auth/jwt-auth.guard';import{PermissionsGuard}from'../auth/permissions.guard';import{ReportsController}from'./reports.controller';import{ReportsService}from'./reports.service';@Module({imports:[AiModule,JwtModule.register({secret:process.env.JWT_SECRET||'davi-super-secret-key',signOptions:{expiresIn:'7d'}})],controllers:[ReportsController,AnalyticsController],providers:[AnalyticsService,AnalyticsAccess,AnalyticsCache,AnalyticsAttention,AnalyticsExports,AnalyticsInsights,OperationsAccessService,ReportsService,JwtAuthGuard,PermissionsGuard]})export class ReportsModule{}
