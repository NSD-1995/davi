import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {OperationsAccessService} from '../auth/operations-access.service';
import {StaffAttendanceService} from './staff-attendance.service';
import {attendanceDate,localClock,CoverageService} from '../timetable/coverage.service';
import {defaultLeavePolicy,LeavePolicy,leaveCreditSchedule} from './leave-policy';
import {operationsTransaction} from './operations-transaction';
import {effectiveAttendancePolicy} from './attendance-policy';

@Injectable()
export class LeaveBalanceService {
  constructor(private readonly db:PrismaService,private readonly attendance:StaffAttendanceService,private readonly access:OperationsAccessService,private readonly coverage:CoverageService){}
  async policy(s:string,type:string,tx:any){const ops=await this.attendance.policy(s,tx);const configured=ops.leavePolicies.find((p:any)=>p.leaveType===type);return configured?{...defaultLeavePolicy,...configured}:null;}
  async period(tx:any,s:string,date:Date,policy:LeavePolicy){
    if(policy.period==='ACADEMIC'){
      const year=await tx.academicYear.findFirst({where:{schoolId:s,startDate:{lte:date},endDate:{gte:date}},orderBy:{startDate:'desc'}});
      if(!year?.startDate||!year.endDate)throw new BadRequestException('Configure academic-year dates covering this leave period.');
      return{key:'ACADEMIC:'+year.id,year:year.startDate.getUTCFullYear(),start:attendanceDate(year.startDate.toISOString().slice(0,10)),end:attendanceDate(year.endDate.toISOString().slice(0,10))};
    }
    const year=date.getUTCFullYear();return{key:'CALENDAR:'+year,year,start:new Date(Date.UTC(year,0,1)),end:new Date(Date.UTC(year,11,31))};
  }
  async entry(tx:any,balance:any,kind:string,days:number,key:string,date:Date,reason:string,actorId?:string,leaveRequestId?:string){
    const exists=await tx.leaveLedger.findUnique({where:{schoolId_dedupeKey:{schoolId:balance.schoolId,dedupeKey:key}}});
    if(exists)return false;
    await tx.leaveLedger.create({data:{schoolId:balance.schoolId,balanceId:balance.id,kind,days,dedupeKey:key,effectiveDate:date,reason,actorId:actorId||null,leaveRequestId:leaveRequestId||null}});return true;
  }
  async accrue(tx:any,balance:any,staff:any,asOf:Date){
    if(balance.manualAllocation||!balance.policySnapshot)return balance;
    const policy=balance.policySnapshot as LeavePolicy;
    for(const credit of leaveCreditSchedule(policy,balance.periodStart,balance.periodEnd,asOf,staff.joiningDate)){
      const available=balance.entitlement-balance.used;
      const days=Math.max(0,policy.maximumBalance===null?credit.days:Math.min(credit.days,policy.maximumBalance-available));
      if(await this.entry(tx,balance,'CREDIT',days,'CREDIT:'+balance.id+':'+credit.key,credit.date,'Scheduled '+policy.allocation.toLowerCase()+' leave credit'))balance=await tx.staffLeaveBalance.update({where:{id:balance.id},data:{entitlement:{increment:days}}});
    }
    return balance;
  }
  async ensure(tx:any,s:string,staff:any,type:string,date:Date,asOf:Date){
    const configured=await this.policy(s,type,tx);
    let balance=await tx.staffLeaveBalance.findFirst({where:{schoolId:s,staffId:staff.id,leaveType:type,periodStart:{lte:date},periodEnd:{gte:date}},orderBy:{periodStart:'asc'}});
    const period=balance?{key:balance.periodKey,year:balance.year,start:balance.periodStart,end:balance.periodEnd}:await this.period(tx,s,date,configured||defaultLeavePolicy);
    if(!balance)balance=await tx.staffLeaveBalance.findUnique({where:{schoolId_staffId_leaveType_periodKey:{schoolId:s,staffId:staff.id,leaveType:type,periodKey:period.key}}});
    if(!balance){
      if(await tx.staffLeaveBalance.findFirst({where:{schoolId:s,staffId:staff.id,leaveType:type,periodStart:{lte:period.end},periodEnd:{gte:period.start}}}))throw new ConflictException('The new leave period overlaps an existing balance period. Keep consistent calendar/academic boundaries.');
      balance=await tx.staffLeaveBalance.create({data:{schoolId:s,staffId:staff.id,leaveType:type,year:period.year,periodKey:period.key,periodStart:period.start,periodEnd:period.end,manualAllocation:!configured,policySnapshot:configured||{...defaultLeavePolicy,leaveType:type,allowNegative:true,legacyUncapped:true}}});
      if(configured?.carryForward&&asOf>=period.start){
        const priorDate=new Date(+period.start-86400000);let priorPeriod:any;
        try{priorPeriod=await this.period(tx,s,priorDate,configured);}catch{priorPeriod=null;}
        let previous=priorPeriod&&await tx.staffLeaveBalance.findUnique({where:{schoolId_staffId_leaveType_periodKey:{schoolId:s,staffId:staff.id,leaveType:type,periodKey:priorPeriod.key}}});
        if(previous){previous=await this.accrue(tx,previous,staff,priorDate);const days=Math.max(0,Math.min(previous.entitlement-previous.used,configured.maximumCarryForward,configured.maximumBalance??Infinity));if(await this.entry(tx,balance,'CARRY_FORWARD',days,'CARRY:'+balance.id,period.start,'Carry-forward from '+previous.periodKey))balance=await tx.staffLeaveBalance.update({where:{id:balance.id},data:{entitlement:{increment:days}}});}
      }
    }
    if(!balance.policySnapshot&&configured)balance=await tx.staffLeaveBalance.update({where:{id:balance.id},data:{policySnapshot:configured}});
    return this.accrue(tx,balance,staff,asOf);
  }
  async asOf(s:string,tx:any){return attendanceDate(localClock(new Date(),(await this.coverage.policy(s,tx)).timeZone).date);}
  async own(s:string,userId:string){
    await this.access.actor(s,userId);const staff=await this.db.staff.findFirst({where:{schoolId:s,userId,status:'ACTIVE'}});if(!staff)throw new NotFoundException('Active staff profile required.');
    return operationsTransaction(this.db,async tx=>{const asOf=await this.asOf(s,tx),ops=await this.attendance.policy(s,tx);for(const policy of ops.leavePolicies)await this.ensure(tx,s,staff,policy.leaveType,asOf,asOf);return tx.staffLeaveBalance.findMany({where:{schoolId:s,staffId:staff.id},orderBy:{year:'desc'}});});
  }
  async applyDecision(tx:any,s:string,request:any,status:string,userId:string){
    const asOf=await this.asOf(s,tx);
    if(status==='CANCELLED'&&request.status==='APPROVED'){
      const debits=await tx.leaveLedger.findMany({where:{schoolId:s,leaveRequestId:request.id,kind:'DEDUCTION'},include:{balance:true}});
      for(const debit of debits){if(await this.entry(tx,debit.balance,'REFUND',-debit.days,'REFUND:'+request.id+':'+debit.balanceId,asOf,'Approved leave cancellation',userId,request.id))await tx.staffLeaveBalance.update({where:{id:debit.balanceId},data:{used:{decrement:-debit.days}}});}
      if(!debits.length&&request.balanceDebited){const legacy=await tx.staffLeaveBalance.findFirst({where:{schoolId:s,staffId:request.staffId,leaveType:request.leaveType,year:request.startDate.getUTCFullYear()}});if(legacy&&await this.entry(tx,legacy,'REFUND',request.chargedDays,'REFUND:'+request.id+':'+legacy.id,asOf,'Cancellation of legacy leave',userId,request.id))await tx.staffLeaveBalance.update({where:{id:legacy.id},data:{used:{decrement:request.chargedDays}}});}
      return{chargedDays:0,balanceDebited:false};
    }
    if(status!=='APPROVED')return{chargedDays:request.chargedDays,balanceDebited:request.balanceDebited};
    const staff=await tx.staff.findFirst({where:{id:request.staffId,schoolId:s},include:{user:{select:{profileOptions:{select:{optionId:true,value:true}}}}}});if(!staff)throw new NotFoundException('Staff not found.');
    const schedule=effectiveAttendancePolicy(await this.attendance.policy(s,tx),staff);
    const configured=await this.policy(s,request.leaveType,tx);
    if(request.halfDay&&configured&&!configured.halfDayAllowed)throw new BadRequestException('Half-day leave is disabled for this leave type.');
    const grouped=new Map<string,{balance:any;days:number}>();
    for(let date=new Date(request.startDate);date<=request.endDate;date=new Date(+date+86400000)){
      const calendar=await this.attendance.calendar(s,date.toISOString().slice(0,10),tx);
      const weeklyOff=!schedule.workingDays.includes(date.getUTCDay()||7);
      if((calendar.holiday&&!configured?.countHolidays)||(weeklyOff&&!configured?.countWeeklyOff))continue;
      const balance=await this.ensure(tx,s,staff,request.leaveType,date,asOf),entry=grouped.get(balance.id)||{balance,days:0};entry.days+=request.halfDay?0.5:1;grouped.set(balance.id,entry);
    }
    if(!grouped.size)throw new BadRequestException('Leave contains no chargeable working days.');
    let total=0;
    for(const {balance,days}of grouped.values()){
      const policy=(balance.policySnapshot||{...defaultLeavePolicy,allowNegative:false}) as LeavePolicy;
      if(policy.paid&&!policy.allowNegative&&balance.entitlement-balance.used+0.00001<days)throw new ConflictException('Insufficient '+request.leaveType+' balance in '+balance.periodKey+'.');
      if(await this.entry(tx,balance,'DEDUCTION',-days,'DEDUCTION:'+request.id+':'+balance.id,request.startDate,'Approved leave',userId,request.id))await tx.staffLeaveBalance.update({where:{id:balance.id},data:{used:{increment:days}}});
      total+=days;
    }
    return{chargedDays:total,balanceDebited:true};
  }
  async allocate(s:string,userId:string,data:any){
    const actor=await this.access.actor(s,userId);if(!actor.admin&&!actor.permissions.has('staff.leave.policy.manage'))throw new ForbiddenException('Leave policy management permission is required.');
    if(!Number.isInteger(data.year)||data.year<2000||data.year>2200||!Number.isFinite(data.entitlement)||data.entitlement<0)throw new BadRequestException('Invalid annual entitlement.');
    return operationsTransaction(this.db,async tx=>{const staff=await tx.staff.findFirst({where:{id:data.staffId,schoolId:s}});if(!staff||!(await this.attendance.policy(s,tx)).leaveTypes.includes(data.leaveType))throw new BadRequestException('Choose a staff member and leave type from this school.');
      const key={schoolId:s,staffId:staff.id,leaveType:data.leaveType,periodKey:data.periodKey||'CALENDAR:'+data.year};
      let before=await tx.staffLeaveBalance.findUnique({where:{schoolId_staffId_leaveType_periodKey:key}});
      if(data.periodKey&&!before&&data.periodKey!=='CALENDAR:'+data.year)throw new BadRequestException('Choose an existing leave period or allocate a calendar-year opening balance.');
      if(before&&data.entitlement<before.used&&(before.policySnapshot as any)?.paid!==false&&!(before.policySnapshot as any)?.allowNegative)throw new ConflictException('Entitlement cannot be lower than used leave.');
      const after=await tx.staffLeaveBalance.upsert({where:{schoolId_staffId_leaveType_periodKey:key},create:{...key,year:data.year,manualAllocation:true,entitlement:data.entitlement,periodStart:new Date(Date.UTC(data.year,0,1)),periodEnd:new Date(Date.UTC(data.year,11,31))},update:{manualAllocation:true,entitlement:data.entitlement}});
      const difference=data.entitlement-(before?.entitlement||0);await this.entry(tx,after,before?'ADJUSTMENT':'OPENING',difference,'ALLOCATION:'+after.id+':'+after.updatedAt.toISOString(),await this.asOf(s,tx),String(data.reason||'Authorized entitlement allocation'),userId);
      await tx.auditLog.create({data:{schoolId:s,actorId:userId,method:'PUT',path:'/school-operations/balances',action:'LEAVE_BALANCE',entityType:'StaffLeaveBalance',entityId:after.id,metadata:{before:before?JSON.parse(JSON.stringify(before)):null,after:JSON.parse(JSON.stringify(after))}}});return after;
    });
  }
  async ledger(s:string,userId:string,staffId?:string){
    let id:string;if(staffId){const {rows}=await this.access.staff(s,userId,'staff.leave.approve');if(!rows.some((r:any)=>r.id===staffId))throw new ForbiddenException('Staff outside your scope.');id=staffId;}else{await this.access.actor(s,userId);const own=await this.db.staff.findFirst({where:{schoolId:s,userId,status:'ACTIVE'}});if(!own)throw new NotFoundException('Staff profile required.');id=own.id;}
    return this.db.leaveLedger.findMany({where:{schoolId:s,balance:{schoolId:s,staffId:id}},include:{balance:{select:{leaveType:true,periodKey:true}}},orderBy:{createdAt:'desc'},take:500});
  }
}
