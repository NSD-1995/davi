import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationsAccessService } from '../auth/operations-access.service';
import { admissionsTransaction } from '../student-admissions/admissions-transaction';
import { attendanceDate, localClock } from '../timetable/coverage.service';
import { z } from 'zod';
import * as rules from './engagement.rules';
const identity={select:{id:true,firstName:true,lastName:true}};
@Injectable()
export class EngagementService {
 constructor(private db:PrismaService,private access:OperationsAccessService){}
 async context(user:any){const actor=await this.access.actor(user.schoolId,user.id);if(!actor.admin&&!actor.permissions.has('LESSON_PLAN_VIEW')&&!actor.permissions.has('COMMUNICATION_VIEW'))throw new ForbiddenException('Academic or communication access required.');const [setting,year]=await Promise.all([this.db.schoolSetting.findUnique({where:{schoolId:user.schoolId}}),this.db.academicYear.findFirst({where:{schoolId:user.schoolId,isCurrent:true},select:{id:true}})]);const timeZone=(setting?.coveragePolicy as any)?.timeZone||setting?.timezone||'UTC';return {...localClock(new Date(),timeZone),timeZone,academicYearId:year?.id||null};}
 private readerRole(s:string){return {some:{role:{schoolId:s,isActive:true,OR:[{code:'SCHOOL_ADMIN'},{rolePermissions:{some:{permission:{code:'COMMUNICATION_VIEW'}}}}]}}};}
 async queryAssignees(user:any){const actor=await this.access.actor(user.schoolId,user.id,'COMMUNICATION_MANAGE');if(!actor.admin)throw new ForbiddenException('School administrator required.');return this.db.user.findMany({where:{schoolId:user.schoolId,status:'ACTIVE',staff:{is:{schoolId:user.schoolId,status:'ACTIVE'}},roles:this.readerRole(user.schoolId)},select:{id:true,firstName:true,lastName:true},orderBy:{firstName:'asc'},take:500});}
 async personalAlerts(user:any){
  const memberships=user.schoolId?[user.schoolId]:(await this.db.parentSchoolMembership.findMany({where:{parent:{userId:user.id},status:'ACTIVE',verificationStatus:'VERIFIED'},select:{schoolId:true}})).map(m=>m.schoolId);
  return this.db.notification.findMany({where:{recipientId:user.id,schoolId:{in:memberships},channel:'IN_APP'},orderBy:{createdAt:'desc'},take:100});
 }
 async readPersonalAlert(user:any,id:string){rules.parse(rules.id,id);const row=await this.db.notification.findFirst({where:{id,recipientId:user.id,channel:'IN_APP'}});if(!row)throw new NotFoundException('Personal alert not found.');if(user.schoolId!==row.schoolId&&!await this.db.parentSchoolMembership.findFirst({where:{schoolId:row.schoolId!,parent:{userId:user.id},status:'ACTIVE',verificationStatus:'VERIFIED'}}))throw new ForbiddenException('Verified membership required.');return this.db.notification.update({where:{id},data:{readAt:new Date()}});}
 private audit(tx:any,s:string,userId:string,action:string,id:string,metadata:any={}){return tx.auditLog.create({data:{schoolId:s,actorId:userId,method:'POST',path:'/engagement',action,entityType:action.startsWith('ACTIVITY')?'DailyActivity':'ParentQuery',entityId:id,metadata}});}
 private async notify(tx:any,s:string,to:string|null,key:string,title:string){if(to)await tx.notification.upsert({where:{schoolId_dedupeKey:{schoolId:s,dedupeKey:key}},create:{schoolId:s,recipientId:to,dedupeKey:key,channel:'IN_APP',title,message:'Open the linked school workspace to review your assigned work. Parent messages are private.',status:'SENT',sentAt:new Date()},update:{}});}
 async parentEnrollment(userId:string,enrollmentId:string,tx:any=this.db){
  const e=await tx.studentEnrollment.findFirst({where:{id:enrollmentId,status:'ACTIVE',student:{studentParents:{some:{status:'ACTIVE',canViewAcademics:true,parent:{userId,memberships:{some:{status:'ACTIVE',verificationStatus:'VERIFIED',school:{studentEnrollments:{some:{id:enrollmentId}}}}}}}}}},include:{student:{select:{studentParents:{where:{status:'ACTIVE',canViewAcademics:true,parent:{userId}},select:{parentId:true}}}}}});
  if(!e)throw new ForbiddenException('Verified linked-child access required.');
  const member=await tx.parentSchoolMembership.findFirst({where:{schoolId:e.schoolId,parentId:e.student.studentParents[0]?.parentId,status:'ACTIVE',verificationStatus:'VERIFIED'}});
  if(!member)throw new ForbiddenException('Verified school membership required.');return {e,parentId:member.parentId};
 }
 async queryScope(user:any,tx:any=this.db){const actor=await this.access.actor(user.schoolId,user.id,'COMMUNICATION_VIEW',tx);return {schoolId:user.schoolId,...(actor.admin?{}:{assignedToId:user.id})};}
 async queries(user:any,enrollmentId?:string,page=0){
  if(!Number.isInteger(page)||page<0||page>100)throw new BadRequestException('Invalid query page.');
  if(!user.schoolId){if(!enrollmentId)throw new BadRequestException('Select a linked child.');const p=await this.parentEnrollment(user.id,rules.parse(rules.id,enrollmentId));return this.db.parentQuery.findMany({where:{schoolId:p.e.schoolId,enrollmentId,parentId:p.parentId},select:{id:true,subject:true,category:true,status:true,dueAt:true,version:true,updatedAt:true,assignedTo:identity},orderBy:[{updatedAt:'desc'},{id:'asc'}],skip:page*100,take:100});}
  return this.db.parentQuery.findMany({where:{...await this.queryScope(user),...(enrollmentId?{enrollmentId:rules.parse(rules.id,enrollmentId)}:{})},select:{id:true,subject:true,category:true,status:true,dueAt:true,version:true,updatedAt:true,assignedTo:identity},orderBy:[{updatedAt:'desc'},{id:'asc'}],skip:page*100,take:100});
 }
 async createQuery(user:any,raw:unknown){const d=rules.parse(rules.createQuery,raw);return admissionsTransaction(this.db,async tx=>{
  const {e,parentId}=await this.parentEnrollment(user.id,d.enrollmentId,tx);
  const assignment=e.sectionId?await tx.teacherAcademicAssignment.findFirst({where:{schoolId:e.schoolId,academicYearId:e.academicYearId,classId:e.classId,sectionId:e.sectionId,isClassTeacher:true,isActive:true,teacher:{status:'ACTIVE',user:{status:'ACTIVE',roles:this.readerRole(e.schoolId)}}},include:{teacher:{select:{userId:true}}}}):null;
  const setting=await tx.schoolSetting.findUnique({where:{schoolId:e.schoolId}}),hours=Number((setting?.operationsPolicy as any)?.parentQueryResponseHours||48);
  const row=await tx.parentQuery.create({data:{schoolId:e.schoolId,enrollmentId:e.id,parentId,assignedToId:assignment?.teacher.userId||null,category:d.category,subject:d.subject,status:assignment?'ASSIGNED':'NEW',dueAt:new Date(Date.now()+Math.min(720,Math.max(1,hours))*3600000),messages:{create:{authorId:user.id,message:d.message}}}});
  await this.audit(tx,e.schoolId,user.id,'QUERY_CREATED',row.id,{assignedToId:row.assignedToId});await this.notify(tx,e.schoolId,row.assignedToId,'QUERY:'+row.id+':1','Parent query assigned');return row;
 });}
 async query(user:any,id:string,tx:any=this.db){
  rules.parse(rules.id,id);const row=await tx.parentQuery.findFirst({where:{id,...(user.schoolId?await this.queryScope(user,tx):{parent:{userId:user.id}})},include:{parent:{select:{userId:true}},enrollment:{select:{classId:true,sectionId:true,schoolId:true,academicYearId:true}},assignedTo:identity}});
  if(!row)throw new NotFoundException('Query not found for this participant.');if(!user.schoolId)await this.parentEnrollment(user.id,row.enrollmentId,tx);return row;
 }
 async detail(user:any,id:string,before?:string){const row=await this.query(user,id);if(before&&!await this.db.parentQueryMessage.findFirst({where:{id:rules.parse(rules.id,before),queryId:id},select:{id:true}}))throw new NotFoundException('Conversation cursor not found.');const messages=await this.db.parentQueryMessage.findMany({where:{queryId:row.id},...(before?{cursor:{id:before},skip:1}:{}),include:{author:identity},orderBy:[{createdAt:'desc'},{id:'desc'}],take:100});messages.reverse();return {...row,messages,olderCursor:messages.length===100?messages[0].id:null};}
 async changeQuery(user:any,id:string,raw:unknown){const d=rules.parse(rules.changeQuery,raw);return admissionsTransaction(this.db,async tx=>{
  const row=await this.query(user,id,tx),parent=!user.schoolId;if(row.version!==d.version)throw new ConflictException('Query changed. Refresh before saving.');
  if(row.status==='RESOLVED')throw new ConflictException('Resolved queries are closed. Create a new query.');
  if(parent&&(d.assignedToId||d.status))throw new ForbiddenException('Parents may only add replies.');
  let status=d.status||row.status;
  if(d.status)rules.queryTransition(row.status,d.status,parent);
  if(d.assignedToId){const actor=await this.access.actor(user.schoolId,user.id,'COMMUNICATION_MANAGE',tx);if(!actor.admin)throw new ForbiddenException('Only school administrators can reassign a parent query.');
   const assignee=await tx.user.findFirst({where:{id:d.assignedToId,schoolId:row.schoolId,status:'ACTIVE',staff:{is:{schoolId:row.schoolId,status:'ACTIVE'}},roles:this.readerRole(row.schoolId)}});if(!assignee)throw new BadRequestException('Choose active school staff with communication access.');status='ASSIGNED';
  }
  let renewedDueAt:Date|undefined;
  if(parent&&row.status==='AWAITING_PARENT'){status='IN_PROGRESS';const policy=await tx.schoolSetting.findUnique({where:{schoolId:row.schoolId}});const hours=Number((policy?.operationsPolicy as any)?.parentQueryResponseHours||48);renewedDueAt=new Date(Date.now()+Math.min(720,Math.max(1,hours))*3600000);}
  if(!parent&&!row.assignedToId&&!d.assignedToId&&status!=='RESOLVED'&&status!=='ESCALATED')throw new BadRequestException('Assign a staff participant before requesting a response.');
  if(d.message)await tx.parentQueryMessage.create({data:{queryId:id,authorId:user.id,message:d.message}});
  const saved=await tx.parentQuery.updateMany({where:{id,schoolId:row.schoolId,version:d.version},data:{status,...(d.assignedToId?{assignedToId:d.assignedToId}:{}),...(renewedDueAt?{dueAt:renewedDueAt}:{}),resolvedAt:status==='RESOLVED'?new Date():null,version:{increment:1}}});if(!saved.count)throw new ConflictException('Query changed.');
  await this.audit(tx,row.schoolId,user.id,'QUERY_UPDATED',id,{from:row.status,to:status,messageAdded:!!d.message,assignedToId:d.assignedToId||row.assignedToId});
  const recipient=parent?(d.assignedToId||row.assignedToId):d.assignedToId||row.parent.userId;
  await this.notify(tx,row.schoolId,recipient,'QUERY:'+id+':'+(d.version+1),status==='ESCALATED'?'Parent query escalated':d.assignedToId?'Parent query assigned':'Parent query updated');
  if(status==='ESCALATED'){const admins=await tx.user.findMany({where:{schoolId:row.schoolId,status:'ACTIVE',roles:{some:{role:{schoolId:row.schoolId,code:'SCHOOL_ADMIN',isActive:true}}}},select:{id:true},take:100});for(const admin of admins)await this.notify(tx,row.schoolId,admin.id,'QUERY:'+id+':'+(d.version+1)+':ESCALATED','Parent query escalated');}
  return {updated:true};
 });}
 async activityScope(user:any,permission='LESSON_PLAN_VIEW',tx:any=this.db):Promise<any>{const actor=await this.access.actor(user.schoolId,user.id,permission,tx);return {schoolId:user.schoolId,...(actor.admin?{}:{teacher:{userId:user.id,status:'ACTIVE' as const}})};}
 async activities(user:any,date:string,year?:string){return this.db.dailyActivity.findMany({where:{...await this.activityScope(user),date:attendanceDate(date),...(year?{academicYearId:rules.parse(rules.id,year)}:{})},include:{schoolClass:{select:{name:true}},section:{select:{name:true}},teacher:{select:{user:identity}}},orderBy:[{startTime:'asc'},{id:'asc'}],take:100});}
 async activityOptions(user:any,year:string){rules.parse(rules.id,year);const actor=await this.access.actor(user.schoolId,user.id,'LESSON_PLAN_MANAGE');const assignments=await this.db.teacherAcademicAssignment.findMany({where:{schoolId:user.schoolId,academicYearId:year,isActive:true,sectionId:{not:null},teacher:{status:'ACTIVE',user:{status:'ACTIVE'},...(!actor.admin?{userId:user.id}:{})}},select:{classId:true,sectionId:true,teacherId:true,schoolClass:{select:{name:true}},section:{select:{name:true}},teacher:{select:{user:identity}}},take:500});return assignments;}
 async createActivity(user:any,raw:unknown){const d=rules.parse(rules.createActivity,raw);return admissionsTransaction(this.db,async tx=>{
  const actor=await this.access.actor(user.schoolId,user.id,'LESSON_PLAN_MANAGE',tx);
  const section=await tx.section.findFirst({where:{id:d.sectionId,schoolId:user.schoolId,classId:d.classId,status:'ACTIVE',schoolClass:{academicYearId:d.academicYearId,status:'ACTIVE',academicYear:{schoolId:user.schoolId}}}});if(!section)throw new BadRequestException('Choose a section in this school and academic year.');
  if(!await tx.teacherAcademicAssignment.findFirst({where:{schoolId:user.schoolId,academicYearId:d.academicYearId,classId:d.classId,sectionId:d.sectionId,teacherId:d.teacherId,isActive:true,teacher:{schoolId:user.schoolId,status:'ACTIVE',user:{status:'ACTIVE'},...(!actor.admin?{userId:user.id}:{})}}}))throw new ForbiddenException('Choose an assigned teacher in this section.');
  const {date,...fields}=d;const row=await tx.dailyActivity.create({data:{...fields,date:attendanceDate(date),schoolId:user.schoolId}});await this.audit(tx,user.schoolId,user.id,'ACTIVITY_CREATED',row.id);return row;
 });}
 async changeActivity(user:any,id:string,raw:unknown){rules.parse(rules.id,id);const d=rules.parse(z.object({version:rules.version,status:z.enum(rules.activityStates)}).strict(),raw);return admissionsTransaction(this.db,async tx=>{
  const row=await tx.dailyActivity.findFirst({where:{id,...await this.activityScope(user,'LESSON_PLAN_MANAGE',tx)}});if(!row)throw new NotFoundException('Assigned activity not found.');rules.activityTransition(row.status,d.status);
  if(!await tx.dailyActivity.updateMany({where:{id,schoolId:user.schoolId,version:d.version},data:{status:d.status,completedAt:d.status==='COMPLETED'?new Date():null,version:{increment:1}}}).then((r:any)=>r.count))throw new ConflictException('Activity changed. Refresh.');
  await this.audit(tx,user.schoolId,user.id,'ACTIVITY_UPDATED',id,{from:row.status,to:d.status});return {updated:true};
 });}
 async readPolicy(user:any){const actor=await this.access.actor(user.schoolId,user.id,'COMMUNICATION_VIEW');if(!actor.admin)throw new ForbiddenException('School administrator required.');const row=await this.db.schoolSetting.findUnique({where:{schoolId:user.schoolId}}),p=(row?.operationsPolicy as any)||{};return {hours:p.parentQueryResponseHours||48,studentAttendanceDeadline:p.studentAttendanceDeadline||null};}
 async responsePolicy(user:any,raw:unknown){const d=rules.parse(z.object({hours:z.number().int().min(1).max(720),studentAttendanceDeadline:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional()}).strict(),raw);return admissionsTransaction(this.db,async tx=>{const actor=await this.access.actor(user.schoolId,user.id,'COMMUNICATION_MANAGE',tx);if(!actor.admin)throw new ForbiddenException('School administrator required.');const row=await tx.schoolSetting.findUnique({where:{schoolId:user.schoolId}}),policy={...((row?.operationsPolicy as any)||{}),parentQueryResponseHours:d.hours,...(d.studentAttendanceDeadline!==undefined?{studentAttendanceDeadline:d.studentAttendanceDeadline}:{})};await tx.schoolSetting.upsert({where:{schoolId:user.schoolId},create:{schoolId:user.schoolId,operationsPolicy:policy},update:{operationsPolicy:policy}});await this.audit(tx,user.schoolId,user.id,'QUERY_RESPONSE_POLICY',user.schoolId,d);return d;});}
}
