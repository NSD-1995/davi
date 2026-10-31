import { rate } from '../reports/analytics-metrics';
import { localClock } from '../timetable/coverage.service';

export function studentDayState(section:any, assignments:any[], plans:any[], events:any[], date:string, timeZone:string, year:any, workingDays?:number[]) {
 const day=new Date(date+'T00:00:00Z'),weekday=day.getUTCDay()||7;
 if((year?.startDate&&date<new Date(year.startDate).toISOString().slice(0,10))||(year?.endDate&&date>new Date(year.endDate).toISOString().slice(0,10)))return 'OUTSIDE_YEAR';
 if(events.some(event=>['HOLIDAY','SCHOOL_CLOSURE'].includes(event.eventType.toUpperCase())&&['ALL','CLASS:'+section.id].includes(event.audience)&&localClock(new Date(event.startsAt),timeZone).date<=date&&date<=localClock(new Date(event.endsAt||event.startsAt),timeZone).date))return 'HOLIDAY';
 const scoped=assignments.filter(row=>row.classId===section.classId&&(!row.sectionId||row.sectionId===section.id));
 const assignment=scoped.find(row=>row.sectionId===section.id)||scoped.find(row=>!row.sectionId);
 const days=assignment?.template?.workingDays||plans.find(p=>p.sectionId===section.id&&p.status==='PUBLISHED')?.template?.workingDays||workingDays;
 return !Array.isArray(days)?'NOT_CONFIGURED':days.includes(weekday)?'WORKING':'WEEKLY_OFF';
}
export function studentAttendanceSnapshot(enrollments:any[],records:any[],sections:any[],dayStates:Record<string,string>) {
 const byId=new Map(enrollments.map(row=>[row.id,row]));
 const valid=new Map(records.filter(row=>byId.has(row.enrollmentId)).map(row=>[row.enrollmentId,row]));
 const statuses=['PRESENT','ABSENT','LATE','EXCUSED','HALF_DAY','ON_DUTY'];
 const totals=new Map<string,number>(),groups=new Map<string,Record<string,number>>();
 for(const row of enrollments)totals.set(row.sectionId,(totals.get(row.sectionId)||0)+1);
 for(const row of valid.values()){if(!statuses.includes(row.status))continue;const sectionId=byId.get(row.enrollmentId)!.sectionId;const counts=groups.get(sectionId)||Object.fromEntries(statuses.map(status=>[status,0]));counts[row.status]++;groups.set(sectionId,counts);}
 const rows=sections.map(section=>{const total=totals.get(section.id)||0,status=groups.get(section.id)||Object.fromEntries(statuses.map(key=>[key,0])),recorded=Object.values(status).reduce((a,b)=>a+b,0),working=dayStates[section.id]==='WORKING';return {classId:section.classId,className:section.className,sectionId:section.id,sectionName:section.name,total,statuses:status,recorded,notMarked:working?Math.max(0,total-recorded):null,dayState:dayStates[section.id],completion:working?rate(recorded,total):null};});
 const expected=rows.filter(row=>row.dayState==='WORKING'),status=Object.fromEntries(statuses.map(key=>[key,expected.reduce((sum,row)=>sum+row.statuses[key],0)])),recorded=Object.values(status).reduce((a,b)=>a+b,0),expectedCount=expected.reduce((sum,row)=>sum+row.total,0);
 return {total:enrollments.length,unassigned:enrollments.filter(row=>!row.sectionId).length,expected:expectedCount,recorded,notMarked:Math.max(0,expectedCount-recorded),percentage:rate(status.PRESENT+status.LATE+status.ON_DUTY+status.HALF_DAY/2,recorded-status.EXCUSED),statuses:status,sections:rows,unknownCalendar:rows.filter(row=>row.dayState==='NOT_CONFIGURED').length};
}
export function canApproveLeaveType(policy:any,userId:string,admin:boolean,type:string) {
 if(admin)return true;
 const configured=policy.leavePolicies?.find((p:any)=>p.leaveType===type)?.approverIds;
 const approvers=configured?.length?configured:policy.leaveApproverIds||[];
 return !approvers.length||approvers.includes(userId);
}
