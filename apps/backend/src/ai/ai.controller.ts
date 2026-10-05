import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AiService } from './ai.service';
import { GenerateLessonPlanDto } from './ai.dto';

@Controller('ai') @UseGuards(JwtAuthGuard,PermissionsGuard)
export class AiController {
  constructor(private readonly service:AiService) {}
  @Post('lesson-plans/generate') @RequirePermissions('LESSON_PLAN_MANAGE')
  generate(@Req() req:any,@Body() dto:GenerateLessonPlanDto) { return this.service.generate(req.user,dto); }
}
