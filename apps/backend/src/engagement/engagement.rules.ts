import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';
export const id=z.string().uuid(),version=z.number().int().positive();
export const queryStates=['NEW','ASSIGNED','IN_PROGRESS','AWAITING_PARENT','RESOLVED','ESCALATED'] as const;
export const activityStates=['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'] as const;
export const categories=['Attendance','Homework','Academic concern','School activity','General question','Other'] as const;
export const message=z.string().trim().min(1).max(5000);
export const createQuery=z.object({enrollmentId:id,category:z.enum(categories),subject:z.string().trim().min(1).max(160),message}).strict();
export const changeQuery=z.object({version,assignedToId:id.optional(),status:z.enum(queryStates).optional(),message:message.optional()}).strict().refine(d=>!!d.assignedToId||!!d.status||!!d.message,'Choose a change.');
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const createActivity=z.object({academicYearId:id,classId:id,sectionId:id,teacherId:id,title:z.string().trim().min(1).max(160),category:z.enum(['Practical Life','Sensorial Development','Rhymes and Music','Storytelling','Art and Craft','Outdoor Play','Environmental Activities','Other']),description:z.string().trim().max(2000).optional(),date:z.string(),startTime:time.optional(),endTime:time.optional()}).strict().refine(d=>!d.endTime||!!d.startTime&&d.endTime>d.startTime,'Choose a valid activity interval.');
export function parse<T>(schema:z.ZodType<T,any,any>,raw:unknown):T{const p=schema.safeParse(raw);if(!p.success)throw new BadRequestException(p.error.issues.map(i=>i.message).join('; '));return p.data;}
export function activityTransition(from:string,to:string){if(from===to)return;if(!({PLANNED:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['COMPLETED','CANCELLED']} as Record<string,string[]>)[from]?.includes(to))throw new ConflictException('This activity transition is not allowed.');}
export function queryTransition(from:string,to:string,parent:boolean){
 if(from===to)return;
 if(parent)throw new BadRequestException('Parents can reply; resolution and escalation require authorized staff.');
 if(from==='RESOLVED'||to==='NEW'||to==='ASSIGNED')throw new ConflictException('Use assignment or a new query for this transition.');
}
export function querySummary(rows:any[],date:string,zone:string,now:Date){
 const local=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const open=rows.filter(r=>r.status!=='RESOLVED'),awaiting=open.filter(r=>r.status!=='AWAITING_PARENT');
 return {total:open.length,new:open.filter(r=>r.status==='NEW').length,assigned:open.filter(r=>!!r.assignedToId).length,unassigned:open.filter(r=>!r.assignedToId).length,awaitingResponse:awaiting.length,awaitingParent:open.filter(r=>r.status==='AWAITING_PARENT').length,overdue:awaiting.filter(r=>r.dueAt<now).length,escalated:open.filter(r=>r.status==='ESCALATED').length,resolvedToday:rows.filter(r=>r.resolvedAt&&local(r.resolvedAt)===date).length};
}
