import { StaffLeaveRequestDto, LeaveDecisionDto, DailyTaskDto, DailyOverrideDto } from './school-operations.dto';
import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SchoolOperationsService } from './school-operations.service';
@Controller('school-operations')
@UseGuards(JwtAuthGuard)
export class SchoolOperationsController {
    @Get('reports') report(@Req() r:any,@Query('from') from:string,@Query('to') to:string) { return this.service.report(r.user.schoolId,r.user.id,from,to); }
    constructor(private readonly service: SchoolOperationsService) { }
    @Get('lookups')
    lookups(
    @Req()
    r: any) { return this.service.lookups(r.user.schoolId, r.user.id); }
    @Get('clock')
    clock(
    @Req()
    r: any) { return this.service.clock(r.user.schoolId, r.user.id); }
    @Get('policy')
    policy(
    @Req()
    r: any) { return this.service.settings(r.user.schoolId, r.user.id); }
    @Put('policy')
    savePolicy(
    @Req()
    r: any, 
    @Body()
    d: any) { return this.service.settings(r.user.schoolId, r.user.id, d); }
    @Get('scopes')
    scopes(
    @Req()
    r: any) { return this.service.scopes(r.user.schoolId, r.user.id); }
    @Put('scopes')
    saveScope(
    @Req()
    r: any, 
    @Body()
    d: any) { return this.service.scopes(r.user.schoolId, r.user.id, d); }
    @Get('leaves')
    leaves(
    @Req()
    r: any, 
    @Query('manage')
    manage: string) { return this.service.leaves(r.user.schoolId, r.user.id, manage === 'true'); }
    @Post('leaves')
    request(
    @Req()
    r: any, 
    @Body()
    d: StaffLeaveRequestDto) { return this.service.requestLeave(r.user.schoolId, r.user.id, d); }
    @Post('leaves/:id/decision')
    decide(
    @Req()
    r: any, 
    @Param('id')
    id: string, 
    @Body()
    d: LeaveDecisionDto) { return this.service.decideLeave(r.user.schoolId, r.user.id, id, d); }
    @Get('leave-ledger') leaveLedger(@Req()r:any,@Query('staffId')staffId?:string){return this.service.leaveLedger(r.user.schoolId,r.user.id,staffId);}
    @Get('balances')
    balances(
    @Req()
    r: any) { return this.service.balances(r.user.schoolId, r.user.id); }
    @Put('balances')
    saveBalance(
    @Req()
    r: any, 
    @Body()
    d: any) { return this.service.balances(r.user.schoolId, r.user.id, d); }
    @Get('tasks')
    tasks(
    @Req()
    r: any, 
    @Query()
    q: any) { return this.service.tasks(r.user.schoolId, r.user.id, q.date, q.manage === 'true'); }
    @Post('tasks')
    task(
    @Req()
    r: any, 
    @Body()
    d: DailyTaskDto) { return this.service.saveTask(r.user.schoolId, r.user.id, d); }
    @Post('tasks/:id/status')
    taskStatus(
    @Req()
    r: any, 
    @Param('id')
    id: string, 
    @Body()
    d: any) { return this.service.taskStatus(r.user.schoolId, r.user.id, id, d); }
    @Get('effective-timetable')
    effective(
    @Req()
    r: any, 
    @Query()
    q: any) { return this.service.effective(r.user.schoolId, r.user.id, q.date, q); }
    @Get('my-day')
    myDay(
    @Req()
    r: any, 
    @Query('date')
    date: string) { return this.service.myDay(r.user.schoolId, r.user.id, date); }
    @Get('overview')
    overview(
    @Req()
    r: any, 
    @Query()
    q: any) { return this.service.overview(r.user.schoolId, r.user.id, q.date, q); }
    @Post('overrides')
    override(
    @Req()
    r: any, 
    @Body()
    d: DailyOverrideDto) { return this.service.override(r.user.schoolId, r.user.id, d); }
}
