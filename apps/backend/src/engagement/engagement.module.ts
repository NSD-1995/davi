import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';
@Module({imports:[JwtModule.register({secret:process.env.JWT_SECRET||'davi-super-secret-key',signOptions:{expiresIn:'7d'}})],controllers:[EngagementController],providers:[EngagementService],exports:[EngagementService]})
export class EngagementModule {}
