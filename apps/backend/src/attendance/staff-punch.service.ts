import {BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {OperationsAccessService} from '../auth/operations-access.service';
import {CoverageService, attendanceDate, localClock, zonedInstant} from '../timetable/coverage.service';
import {StaffAttendanceService} from './staff-attendance.service';
import {clockMinutes, effectiveAttendancePolicy, verifyAttendanceLocation} from './attendance-policy';
import {operationsTransaction} from './operations-transaction';

@Injectable()
export class StaffPunchService {
  constructor(private readonly db:PrismaService,private readonly access:OperationsAccessService,private readonly attendance:StaffAttendanceService,private readonly coverage:CoverageService){}

  async policy(s:string,userId:string,client:any=this.db){
    await this.access.actor(s,userId,undefined,client);
    const staff=await client.staff.findFirst({where:{schoolId:s,userId,status:'ACTIVE',user:{status:'ACTIVE'}},include:{user:{select:{profileOptions:{select:{optionId:true,value:true}}}}}});
    if(!staff)throw new NotFoundException('An active staff profile is required.');
    const policy=effectiveAttendancePolicy(await this.attendance.policy(s,client),staff);
    return{staff,policy};
  }

  async own(s:string,userId:string,now=new Date()){
    const {staff,policy}=await this.policy(s,userId),clock=localClock(now,(await this.coverage.policy(s)).timeZone);
    const attendance=await this.db.staffAttendance.findUnique({where:{staffId_date:{staffId:staff.id,date:attendanceDate(clock.date)}}});
    return{date:clock.date,attendance:attendance||{status:'NOT_MARKED'},policy:this.publicPolicy(policy)};
  }

  publicPolicy(policy:any){return{attendanceMode:policy.attendanceMode,locationVerificationEnabled:policy.locationVerificationEnabled,maximumLocationAccuracy:policy.maximumLocationAccuracy,geofenceRadius:policy.geofenceRadius,checkInTime:policy.checkInTime,checkOutTime:policy.checkOutTime,lateGraceMinutes:policy.lateGraceMinutes,earlyDepartureRule:policy.earlyDepartureRule,correctionRequestsEnabled:policy.correctionRequestsEnabled,shiftName:policy.shiftName};}

  async punch(s:string,userId:string,kind:'CHECK_IN'|'CHECK_OUT',input:any={},now=new Date()){
    const result=await operationsTransaction(this.db,async tx=>{
      const {staff,policy}=await this.policy(s,userId,tx);
      if(policy.attendanceMode==='ADMIN_ONLY')throw new ForbiddenException('Self attendance is disabled. Contact your attendance manager.');
      const schoolClock=await this.coverage.policy(s,tx),clock=localClock(now,schoolClock.timeZone),date=attendanceDate(clock.date);
      if(!policy.workingDays.includes(date.getUTCDay()||7))throw new ConflictException('This is a weekly off for your working schedule. Request an exception if you are working today.');
      const previous=await tx.staffAttendance.findUnique({where:{staffId_date:{staffId:staff.id,date}}});
      const priorPunch=await tx.attendancePunch.findUnique({where:{staffId_date_kind:{staffId:staff.id,date,kind}}});
      if(priorPunch)return{...previous,punch:{id:priorPunch.id,kind,recordedAt:priorPunch.recordedAt,locationVerified:priorPunch.locationVerified}};
      if(kind==='CHECK_OUT'&&!previous?.checkIn)throw new BadRequestException('Check in before checking out.');
      if(kind==='CHECK_IN'&&previous?.checkIn)return previous;
      if(kind==='CHECK_OUT'&&previous?.checkOut)return previous;
      const verified=verifyAttendanceLocation(policy,input);
      const early=kind==='CHECK_OUT'&&clock.time<policy.checkOutTime;
      if(early&&policy.earlyDepartureRule==='REQUIRE_EXCEPTION')throw new ConflictException('Early checkout needs an approved attendance exception. Submit a request to your manager.');
      const status=kind==='CHECK_IN'?(clockMinutes(clock.time)>clockMinutes(policy.checkInTime)+policy.lateGraceMinutes?'LATE':'PRESENT'):previous!.status;
      const saved=await this.attendance.bulk(s,userId,{date:clock.date,records:[{staffId:staff.id,status,version:previous?.version||0,...(kind==='CHECK_IN'?{checkIn:now.toISOString()}:{checkOut:now.toISOString()})}]},kind==='CHECK_IN'?'SELF_CHECKIN':'SELF_CHECKOUT',tx);
      const keep=policy.locationRetentionDays>0;
      const punch=await tx.attendancePunch.create({data:{schoolId:s,staffId:staff.id,date,kind,recordedAt:now,locationVerified:verified.locationVerified,earlyDeparture:early&&policy.earlyDepartureRule==='FLAG',...(keep&&verified.locationVerified?{latitude:verified.latitude,longitude:verified.longitude,accuracy:verified.accuracy,distance:verified.distance,locationExpiresAt:new Date(+now+policy.locationRetentionDays*86400000)}:{})}});
      return{...saved!.records[0],punch:{id:punch.id,kind,recordedAt:punch.recordedAt,locationVerified:punch.locationVerified,earlyDeparture:punch.earlyDeparture}};
    });
    try{return{...result,coverage:await this.coverage.reconcile(s,localClock(now,(await this.coverage.policy(s)).timeZone).date,now)};}catch{return{...result,coverage:{status:'PENDING_RETRY',message:'Attendance saved; cover reassessment will retry.'}};}
  }

  async requestException(s:string,userId:string,data:any){
    const {staff,policy}=await this.policy(s,userId);
    if(!policy.correctionRequestsEnabled)throw new ForbiddenException('Attendance exception requests are disabled by school policy.');
    const date=attendanceDate(data.date);
    if(typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>2000||!['MISSED_CHECKIN','LOCATION','CORRECTION','EARLY_DEPARTURE'].includes(data.kind)||!['PRESENT','LATE','HALF_DAY','ON_DUTY'].includes(data.requestedStatus||'PRESENT'))throw new BadRequestException('Choose a valid exception type, attendance status and reason.');
    const timeZone=(await this.coverage.policy(s)).timeZone;
    const parseTime=(value:any)=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?zonedInstant(data.date,value,timeZone):new Date(value);
    const checkIn=data.requestedCheckIn?parseTime(data.requestedCheckIn):null,checkOut=data.requestedCheckOut?parseTime(data.requestedCheckOut):null;
    for(const stamp of [checkIn,checkOut])if(stamp&&(isNaN(+stamp)||localClock(stamp,timeZone).date!==data.date))throw new BadRequestException('Requested times must belong to the selected school date.');
    if(checkIn&&checkOut&&checkOut<checkIn)throw new BadRequestException('Requested checkout must follow check-in.');
    return operationsTransaction(this.db,async tx=>{
      if(await tx.attendanceExceptionRequest.findFirst({where:{schoolId:s,staffId:staff.id,date,status:'PENDING'}}))throw new ConflictException('You already have a pending exception for this date.');
      const request=await tx.attendanceExceptionRequest.create({data:{schoolId:s,staffId:staff.id,date,kind:data.kind,reason:data.reason.trim(),requestedStatus:data.requestedStatus||'PRESENT',requestedCheckIn:checkIn,requestedCheckOut:checkOut}});
      const admins=await tx.userRole.findMany({where:{schoolId:s,role:{isActive:true,code:'SCHOOL_ADMIN'},user:{status:'ACTIVE'}},select:{userId:true}});
      const ids=new Set<string>([...admins.map((r:any)=>r.userId),...((await this.coverage.policy(s,tx)).inChargeUserIds||[])]);
      for(const recipientId of ids){try{const {actor,rows}=await this.access.staff(s,recipientId,'staff.attendance.override',tx);if(!actor.admin&&!rows.some((r:any)=>r.id===staff.id))continue;await tx.notification.create({data:{schoolId:s,recipientId,dedupeKey:'ATTENDANCE_EXCEPTION:'+request.id+':'+recipientId,channel:'IN_APP',title:'Attendance exception needs review',message:'Review a staff attendance exception in your assigned scope.',status:'SENT',sentAt:new Date()}});}catch(error){if(!(error instanceof ForbiddenException))throw error;}}
      return request;
    });
  }

  async exceptions(s:string,userId:string,manage=false){
    const ids=manage?(await this.access.staff(s,userId,'staff.attendance.override')).rows.map((r:any)=>r.id):[(await this.policy(s,userId)).staff.id];
    return this.db.attendanceExceptionRequest.findMany({where:{schoolId:s,staffId:{in:ids}},include:{staff:{include:{user:{select:{firstName:true,lastName:true}}}}},orderBy:{createdAt:'desc'},take:200});
  }

  async decideException(s:string,userId:string,id:string,data:any){
    if(!['APPROVED','REJECTED','CANCELLED'].includes(data.status)||typeof data.reason!=='string'||!data.reason.trim())throw new BadRequestException('A decision and reason are required.');
    const result=await operationsTransaction(this.db,async tx=>{
      await this.access.actor(s,userId,undefined,tx);
      const before=await tx.attendanceExceptionRequest.findFirst({where:{id,schoolId:s},include:{staff:true}});
      if(!before)throw new NotFoundException('Attendance exception not found.');
      const ownCancel=data.status==='CANCELLED'&&before.staff.userId===userId;
      if(!ownCancel){const {rows}=await this.access.staff(s,userId,'staff.attendance.override',tx);if(!rows.some((r:any)=>r.id===before.staffId))throw new ForbiddenException('Exception is outside your assigned scope.');if(before.staff.userId===userId)throw new ForbiddenException('You cannot decide your own attendance exception.');}
      if(before.status!=='PENDING')throw new ConflictException('Attendance exception already decided.');
      if(data.status==='APPROVED'){
        const checkIn=data.checkIn||before.requestedCheckIn?.toISOString(),checkOut=data.checkOut||before.requestedCheckOut?.toISOString();
        if(before.kind==='MISSED_CHECKIN'&&!checkIn)throw new BadRequestException('Confirm the actual check-in time before approving.');
        if(before.kind==='EARLY_DEPARTURE'&&!checkOut)throw new BadRequestException('Confirm the actual checkout time before approving.');
        await this.attendance.bulk(s,userId,{date:before.date.toISOString().slice(0,10),reason:data.reason,records:[{staffId:before.staffId,status:data.attendanceStatus||before.requestedStatus,...(checkIn?{checkIn}:{}),...(checkOut?{checkOut}:{}),unavailableFrom:data.unavailableFrom,unavailableUntil:data.unavailableUntil}]},'EXCEPTION_APPROVAL',tx);
      }
      const after=await tx.attendanceExceptionRequest.update({where:{id},data:{status:data.status,decidedById:userId,decisionReason:data.reason,decidedAt:new Date()}});
      await tx.auditLog.create({data:{schoolId:s,actorId:userId,method:'POST',path:'/attendance/staff/exceptions/'+id,action:'ATTENDANCE_EXCEPTION_'+data.status,entityType:'AttendanceExceptionRequest',entityId:id,metadata:{before:JSON.parse(JSON.stringify(before)),after:JSON.parse(JSON.stringify(after)),reason:data.reason}}});
      await tx.notification.create({data:{schoolId:s,recipientId:before.staff.userId,dedupeKey:'ATTENDANCE_EXCEPTION_DECISION:'+id,channel:'IN_APP',title:'Attendance exception '+data.status.toLowerCase(),message:data.reason,status:'SENT',sentAt:new Date()}});
      return after;
    });
    try{await this.coverage.reconcile(s,result.date.toISOString().slice(0,10));return result;}catch{return{...result,coveragePendingRetry:true};}
  }
}
