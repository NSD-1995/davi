import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AnnouncementsService } from './announcements.service';
@Controller('announcements') @UseGuards(JwtAuthGuard,PermissionsGuard)
export class AnnouncementsController {
 constructor(private readonly service:AnnouncementsService){}
 @Get() @RequirePermissions('COMMUNICATION_VIEW') list(@Req()r:any,@Query('academicYearId')year:string){return this.service.list(r.user.schoolId,year);}
 @Get('targets') @RequirePermissions('COMMUNICATION_MANAGE') targets(@Req()r:any,@Query('academicYearId')year:string){return this.service.targets(r.user.schoolId,year);}
 @Post() @RequirePermissions('COMMUNICATION_MANAGE') create(@Req()r:any,@Body()d:unknown){return this.service.save(r.user.schoolId,r.user.id,d);}
 @Patch(':id') @RequirePermissions('COMMUNICATION_MANAGE') update(@Req()r:any,@Param('id')id:string,@Body()d:unknown){return this.service.save(r.user.schoolId,r.user.id,d,id);}
}
