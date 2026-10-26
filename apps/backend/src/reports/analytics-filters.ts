import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { localClock, zonedInstant } from '../timetable/coverage.service';
const id=z.string().uuid().optional(),date=z.string().date().optional();
export const analyticsFilterSchema=z.object({academicYearId:z.string().uuid(),classId:id,sectionId:id,enrollmentId:id,subjectId:id,teacherId:id,examId:id,termKey:z.string().max(80).optional(),assessmentType:z.enum(['MARKS','MIXED','GRADE','COMPETENCY','OBSERVATION']).optional(),homeworkStatus:z.enum(['ALL','COMPLETED','PENDING','OVERDUE','EXCUSED']).default('ALL'),attendanceStatus:z.enum(['PRESENT','ABSENT','LATE','EXCUSED','ON_DUTY','HALF_DAY','NOT_MARKED']).optional(),performanceBand:z.enum(['ALL','PASS','BELOW_PASS','MISSING']).default('ALL'),cohort:z.enum(['DUE','CREATED']).default('DUE'),enrollmentStatus:z.enum(['ACTIVE','ALL']).default('ACTIVE'),period:z.enum(['DAY','WEEK','MONTH','YEAR','CUSTOM']).default('MONTH'),date,from:date,to:date}).strict();
export type AnalyticsFilters=z.infer<typeof analyticsFilterSchema>;
export function parseFilters(raw:any){const input=Object.fromEntries(Object.entries(raw||{}).filter(([,v])=>v!==''&&v!==undefined));const p=analyticsFilterSchema.safeParse(input);if(!p.success)throw new BadRequestException(p.error.issues.map(i=>i.path.join('.')+': '+i.message));if(p.data.sectionId&&!p.data.classId)throw new BadRequestException('Choose a class before a section.');return p.data;}
export const addDays=(date:string,n:number)=>new Date(+new Date(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function reportPeriod(f:AnalyticsFilters,year:any,timeZone:string,now=new Date()){
 const today=localClock(now,timeZone).date,anchor=f.date||today;let from=f.from||anchor,to=f.to||anchor;
 if(f.period==='DAY')from=to=anchor;
 if(f.period==='WEEK'){const weekday=new Date(anchor+'T00:00:00Z').getUTCDay();from=addDays(anchor,-((weekday+6)%7));to=addDays(from,6);}
 if(f.period==='MONTH'){from=anchor.slice(0,7)+'-01';to=addDays(from,32).slice(0,7)+'-01';to=addDays(to,-1);}
 if(f.period==='YEAR'){if(!year.startDate||!year.endDate)throw new BadRequestException('Set academic-year dates before using the entire-year period.');from=new Date(year.startDate).toISOString().slice(0,10);to=new Date(year.endDate).toISOString().slice(0,10);}
 if(f.period==='CUSTOM'&&(!f.from||!f.to))throw new BadRequestException('Choose both custom period dates.');
 if(year.startDate)from=from<new Date(year.startDate).toISOString().slice(0,10)?new Date(year.startDate).toISOString().slice(0,10):from;
 if(year.endDate)to=to>new Date(year.endDate).toISOString().slice(0,10)?new Date(year.endDate).toISOString().slice(0,10):to;
 if(from>to||(+new Date(to)-+new Date(from))/86400000>732)throw new BadRequestException('Choose a valid period within the academic year, at most 733 days.');
 return {from,to,today,timeZone,start:zonedInstant(from,'00:00',timeZone),endExclusive:zonedInstant(addDays(to,1),'00:00',timeZone),attendanceFrom:new Date(from+'T00:00:00Z'),attendanceTo:new Date(to+'T00:00:00Z'),semantics:'Inclusive school-local dates; timestamps use [local midnight, next-day midnight). Attendance date-only keys remain UTC midnight.'};
}
