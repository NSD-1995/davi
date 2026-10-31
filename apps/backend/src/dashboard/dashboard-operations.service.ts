import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationsAccessService } from '../auth/operations-access.service';
import { DashboardCommandService } from './dashboard-command.service';
import { EngagementService } from '../engagement/engagement.service';
import { SchoolOperationsService } from '../attendance/school-operations.service';
import { attendanceDate, zonedInstant } from '../timetable/coverage.service';
import { querySummary } from '../engagement/engagement.rules';

export function groupCommandActions(actions:any[],clock:any,deadline?:string){
 const groups=new Map<string,any>();
 const markingDeadline=deadline&&/^([01]\d|2[0-3]):[0-5]\d$/.test(deadline)?deadline:undefined;
 for(const action of actions){const kind=action.key.split(':')[0],key=['attendance','task','homework','lesson','marks'].includes(kind)?kind:action.key;
  const g=groups.get(key)||{key,title:({attendance:'Student attendance pending',task:'Staff duties pending',homework:'Homework awaiting review',lesson:'Academic approval pending',marks:'Missing assessment records'} as Record<string,string>)[key]||action.title,count:0,priority:key==='cover'?'CRITICAL':'NORMAL',status:key==='attendance'&&markingDeadline&&clock.time>markingDeadline?'OVERDUE':'PENDING',href:key==='attendance'?'#attendance-detail':action.href,items:[]};
  if(!g.items.some((i:any)=>i.key===action.key)){g.items.push({...action,...(kind==='attendance'&&markingDeadline&&clock.date&&clock.timeZone?{dueAt:zonedInstant(clock.date,markingDeadline,clock.timeZone).toISOString()}:{} )});g.count+=action.count;if(action.overdue)g.status='OVERDUE';if(['URGENT','HIGH'].includes(action.priority)&&g.priority==='NORMAL')g.priority='HIGH';}groups.set(key,g);
 }
 return [...groups.values()].sort((a,b)=>['CRITICAL','HIGH','NORMAL'].indexOf(a.priority)-['CRITICAL','HIGH','NORMAL'].indexOf(b.priority));
}
@Injectable()
export class DashboardOperationsService {
 constructor(private db:PrismaService,private base:DashboardCommandService,private access:OperationsAccessService,private engagement:EngagementService,private operations:SchoolOperationsService){}
 async get(s:string,userId:string,year?:string,dateValue?:string,now=new Date()){
  if(dateValue)attendanceDate(dateValue);
  const data:any=await this.base.get(s,userId,year,now,dateValue),actor=await this.access.actor(s,userId,'DASHBOARD_VIEW'),can=(p:string)=>actor.admin||actor.permissions.has(p);
  const date=data.clock.date,zone=data.clock.timeZone,start=zonedInstant(date,'00:00',zone),tomorrow=new Date(+attendanceDate(date)+86400000).toISOString().slice(0,10),end=zonedInstant(tomorrow,'00:00',zone),user={schoolId:s,id:userId};
  const setting=await this.db.schoolSetting.findUnique({where:{schoolId:s}}),deadline=(setting?.operationsPolicy as any)?.studentAttendanceDeadline;
  const optional=async(key:string,allowed:boolean,fetch:()=>Promise<any>)=>{if(!allowed){data.sources[key]='restricted';return null;}try{const value=await fetch();data.sources[key]='ready';return value;}catch{data.sources[key]='unavailable';data.errors[key]='This source is unavailable. Refresh or check its module.';return null;}};
  const [activities,queries,preparation,activeStudents,overdueDuties]=await Promise.all([
   optional('dailyActivities',can('LESSON_PLAN_VIEW')&&!!data.academicYear,async()=>{const rows=await this.db.dailyActivity.findMany({where:{...await this.engagement.activityScope(user),academicYearId:data.academicYear.id,date:attendanceDate(date)},include:{schoolClass:{select:{name:true}},section:{select:{name:true}},teacher:{select:{user:{select:{firstName:true,lastName:true}}}}},orderBy:[{startTime:'asc'},{id:'asc'}],take:501});if(rows.length>500)throw Error('limit');return rows;}),
   optional('parentQueries',can('COMMUNICATION_VIEW'),async()=>{const rows=await this.db.parentQuery.findMany({where:{...await this.engagement.queryScope(user),createdAt:{lt:end},OR:[{status:{not:'RESOLVED'}},{resolvedAt:{gte:start,lt:end}}]},select:{id:true,status:true,dueAt:true,resolvedAt:true,assignedToId:true,assignedTo:{select:{firstName:true,lastName:true}}},take:5001});if(rows.length>5000)throw Error('limit');return rows;}),
   optional('tomorrow',can('timetable.substitution.view')||(can('ATTENDANCE_VIEW')&&can('STAFF_VIEW')),async()=>{
    const effective=await this.operations.effective(s,userId,tomorrow,{...(data.academicYear?{academicYearId:data.academicYear.id}:{})});
    const staff=await this.access.staff(s,userId,'timetable.substitution.view'),rows=await this.db.staffLeaveRequest.findMany({where:{schoolId:s,status:'APPROVED',staffId:{in:staff.rows.map((r:any)=>r.id)},startDate:{lte:attendanceDate(tomorrow)},endDate:{gte:attendanceDate(tomorrow)}},select:{id:true},take:1001});if(rows.length>1000)throw Error('limit');
    const acts=can('LESSON_PLAN_VIEW')&&data.academicYear?await this.db.dailyActivity.count({where:{...await this.engagement.activityScope(user),academicYearId:data.academicYear.id,date:attendanceDate(tomorrow),status:'PLANNED'}}):null;
    return {date:tomorrow,approvedLeave:rows.length,uncovered:effective.lessons.filter((l:any)=>l.status==='UNCOVERED').length,activities:acts,setup:data.setup.outstanding};
   }),
   optional('activeStudentCount',!!data.academicYear&&(can('STUDENT_VIEW')||can('ATTENDANCE_VIEW')),()=>this.db.studentEnrollment.count({where:{schoolId:s,academicYearId:data.academicYear.id,status:'ACTIVE',student:{status:'ACTIVE'},...(actor.admin||actor.scope?.schoolWide?{}:{sectionId:{in:Object.keys(data.dayStates)}})}})),
   optional('overdueDuties',can('operations.tasks.manage'),async()=>{const staff=await this.access.staff(s,userId,'operations.tasks.manage');const rows=await this.db.staffDailyTask.findMany({where:{schoolId:s,staffId:{in:staff.rows.map((r:any)=>r.id)},date:{lt:attendanceDate(date)},status:{notIn:['COMPLETED','CANCELLED']}},include:{staff:{select:{user:{select:{firstName:true,lastName:true}}}}},orderBy:[{date:'asc'},{endTime:'asc'}],take:501});if(rows.length>500)throw Error('limit');return rows;})
  ]);
  const activitySummary=activities?{scheduled:activities.length,planned:activities.filter((r:any)=>r.status==='PLANNED').length,inProgress:activities.filter((r:any)=>r.status==='IN_PROGRESS').length,completed:activities.filter((r:any)=>r.status==='COMPLETED').length,cancelled:activities.filter((r:any)=>r.status==='CANCELLED').length,delayed:activities.filter((r:any)=>r.status==='PLANNED'&&r.endTime&&r.endTime<data.clock.time).length}:null;
  const parentQueries=queries?querySummary(queries,date,zone,date===new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(now)?now:end):null;
  const oldDutyActions=(overdueDuties||[]).map((task:any)=>({key:'task:'+task.id,title:task.title,count:1,href:'/operations/duties?date='+task.date.toISOString().slice(0,10),detail:task.staff.user.firstName+' '+task.staff.user.lastName+' | '+task.status+' | Due '+task.date.toISOString().slice(0,10)+' '+task.endTime,overdue:true,priority:task.priority,status:task.status,dueAt:zonedInstant(task.date.toISOString().slice(0,10),task.endTime,zone).toISOString(),responsible:task.staff.user.firstName+' '+task.staff.user.lastName}));
  const groups=groupCommandActions([...data.actions,...oldDutyActions],data.clock,typeof deadline==='string'?deadline:undefined);
  const add=(key:string,title:string,count:number,href:string,priority='NORMAL',status='PENDING')=>{if(count>0)groups.push({key,title,count,href,priority,status,items:[]});};
  // Coverage derives from effective timetable targets, not absent staff counts.
  const existingCover=groups.find(g=>g.key==='cover');if(data.coverageSummary?.urgent){if(existingCover){existingCover.count=data.coverageSummary.urgent;existingCover.title='Uncovered classroom periods';}else add('cover','Uncovered classroom periods',data.coverageSummary.urgent,'/people/teacher-attendance?date='+date,'CRITICAL');}
  if(data.staff?.calendarStatus==='WORKING'&&can('staff.attendance.mark'))add('staff-unmarked','Staff attendance pending',data.staff.statuses.NOT_MARKED,'/operations/attendance?date='+date,'NORMAL');
  if(data.coverageSummary?.pendingConfirmation)add('cover-confirmation','Substitutions awaiting staff confirmation',data.coverageSummary.pendingConfirmation,'/people/teacher-attendance?date='+date,'NORMAL');
  if(parentQueries)add('queries','Parent concerns awaiting staff response',parentQueries.awaitingResponse,'#parent-queries',parentQueries.overdue||parentQueries.escalated?'HIGH':'NORMAL',parentQueries.overdue?'OVERDUE':'PENDING');
  if(activitySummary?.delayed)add('activities','Classroom activities delayed',activitySummary.delayed,'#daily-activities','HIGH','OVERDUE');
  const queryGroup=groups.find(g=>g.key==='queries');if(queryGroup)queryGroup.items=(queries||[]).filter((q:any)=>!['RESOLVED','AWAITING_PARENT'].includes(q.status)).slice(0,20).map((q:any)=>({key:'query:'+q.id,title:'Parent query',count:1,href:'/dashboard?queryId='+q.id+'#parent-queries',detail:q.status+' | Due '+q.dueAt.toISOString()+' | '+(q.assignedToId?'Assigned staff':'Unassigned'),dueAt:q.dueAt.toISOString(),status:q.status,responsible:q.assignedTo?[q.assignedTo.firstName,q.assignedTo.lastName].join(' '):null}));
  const activityGroup=groups.find(g=>g.key==='activities');if(activityGroup)activityGroup.items=(activities||[]).filter((a:any)=>a.status==='PLANNED'&&a.endTime&&a.endTime<data.clock.time).slice(0,20).map((a:any)=>({key:'activity:'+a.id,title:a.title,count:1,href:'#daily-activities',detail:a.schoolClass.name+' / '+a.section.name+' | '+a.teacher.user.firstName+' | Due '+a.endTime,context:a.schoolClass.name+' / '+a.section.name,dueAt:zonedInstant(date,a.endTime,zone).toISOString(),responsible:[a.teacher.user.firstName,a.teacher.user.lastName].join(' '),status:a.status}));
  for(const group of groups){if(['cover','cover-confirmation'].includes(group.key)&&data.coverageDetails)group.items=data.coverageDetails.filter((r:any)=>group.key==='cover'?r.status==='UNCOVERED'&&r.remaining:r.status==='COVERED'&&!r.confirmed).map((r:any)=>({key:'coverage:'+r.key,title:r.title,context:r.context,count:1,href:group.href,detail:r.context||'Dated teaching period',dueAt:r.dueAt,responsible:r.responsible,status:r.status}));const dates=group.items.map((i:any)=>i.dueAt).filter((v:any)=>v&&!Number.isNaN(Date.parse(v))).sort((a:string,b:string)=>Date.parse(a)-Date.parse(b));group.dueAt=dates[0]||null;}
  const actionGroups=groups.sort((a,b)=>['CRITICAL','HIGH','NORMAL'].indexOf(a.priority)-['CRITICAL','HIGH','NORMAL'].indexOf(b.priority)||(a.status==='OVERDUE'?0:1)-(b.status==='OVERDUE'?0:1)||(a.dueAt?Date.parse(a.dueAt):Infinity)-(b.dueAt?Date.parse(b.dueAt):Infinity)||a.key.localeCompare(b.key));
  return {...data,counts:{...data.counts,activeStudents},selectedDate:date,activitySummary,parentQueries,dailyActivities:activities,preparation,actionGroups,pendingSummary:{total:actionGroups.reduce((n,g)=>n+g.count,0),urgent:actionGroups.filter(g=>g.priority==='CRITICAL').reduce((n,g)=>n+g.count,0),overdue:actionGroups.filter(g=>g.status==='OVERDUE').reduce((n,g)=>n+g.count,0),approval:actionGroups.filter(g=>['leaves','lesson'].includes(g.key)).reduce((n,g)=>n+g.count,0),partial:Object.values(data.sources).some(s=>['partial','unavailable'].includes(String(s)))}};
 }
}
