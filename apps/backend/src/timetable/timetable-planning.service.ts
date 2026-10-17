import {TimetableRulesService} from './timetable-rules.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const rangesOverlap = (startA:string,endA:string,startB:string,endB:string) => startA < endB && startB < endA;

export function allocate(requirements:any[],days:number[],slots:any[],blocked=new Set<string>()) {
  const entries:any[]=[];
  const conflicts:string[]=[];
  for(const requirement of requirements){
    let count=0;
    for(const weekday of days){
      let daily=0;
      const ordered=[...slots].sort((a,b)=>Number(requirement.preferredSequences?.includes(b.sequence))-Number(requirement.preferredSequences?.includes(a.sequence))||a.sequence-b.sequence);
      for(const slot of ordered){
        if(count>=requirement.weeklyPeriods||daily>=(requirement.maxPeriodsPerDay||requirement.weeklyPeriods))break;
        const teacherKey=`${requirement.primaryTeacherId}:${weekday}:${slot.id}`;
        const roomKey=`ROOM:${weekday}:${slot.id}`;
        if(blocked.has(teacherKey)||blocked.has(roomKey)||entries.some(entry=>entry.weekday===weekday&&entry.periodSlotId===slot.id))continue;
        const subjectDay=entries.filter(entry=>entry.weekday===weekday&&entry.subjectId===requirement.subjectId);
        let consecutiveCount=0;
        for(let sequence=slot.sequence-1;sequence>=1;sequence--){const previousSlot=slots.find(item=>item.sequence===sequence);if(!previousSlot||!subjectDay.some(entry=>entry.periodSlotId===previousSlot.id))break;consecutiveCount++;}
        if(consecutiveCount>=(requirement.maxConsecutive||1))continue;
        entries.push({subjectId:requirement.subjectId,teacherId:requirement.primaryTeacherId,weekday,periodSlotId:slot.id});
        blocked.add(teacherKey);count++;daily++;
      }
    }
    if(count<requirement.weeklyPeriods)conflicts.push(`MISSING_PERIODS:${requirement.subjectId}:${requirement.weeklyPeriods-count}`);
  }
  return {entries,conflicts};
}

@Injectable()
export class TimetablePlanningService {
  constructor(private readonly prisma:PrismaService, private readonly ruleService:TimetableRulesService) {}
  private school(value:string|null):asserts value is string { if(!value)throw new ForbiddenException('A school account is required.'); }
  private fingerprint(rows:any[]){return createHash('sha256').update(JSON.stringify(rows.map(row=>[row.subjectId,row.primaryTeacherId,row.weeklyPeriods,row.preferredSequences,row.maxConsecutive]).sort())).digest('hex');}
  private async timing(schoolId:string,academicYearId:string,classId:string,date=new Date()){
    const assignment=await this.prisma.periodTemplateAssignment.findFirst({where:{schoolId,academicYearId,classId,isActive:true,effectiveFrom:{lte:date},OR:[{effectiveTo:null},{effectiveTo:{gte:date}}],template:{status:'ACTIVE'}},include:{template:{include:{slots:{orderBy:{sequence:'asc'}}}}}});
    if(!assignment)throw new BadRequestException('Assign and activate a period timing template for this class before generating its timetable.');
    return assignment.template;
  }
  async requirements(schoolId:string|null,academicYearId:string,classId:string){
    this.school(schoolId);
    const [subjects,requirements,draft,template]=await Promise.all([
      this.prisma.classSubject.findMany({where:{schoolId,academicYearId,classId,isActive:true,subject:{status:'ACTIVE'}},include:{subject:true},orderBy:{displayOrder:'asc'}}),
      this.prisma.subjectTimetableRequirement.findMany({where:{schoolId,academicYearId,classId}}),
      this.prisma.timetablePlan.findFirst({where:{schoolId,academicYearId,classId,status:'DRAFT'},orderBy:{version:'desc'}}),
      this.timing(schoolId,academicYearId,classId),
    ]);
    const total=template.workingDays.length*template.slots.filter((slot:any)=>(slot.type==='TEACHING'||slot.type==='SUBJECT')).length;
    const allocated=subjects.reduce((sum:number,row:any)=>sum+row.requiredPeriodsPerWeek,0);
    let changed=false;if(draft){try{const {c}=await this.ruleService.context(schoolId,{academicYearId,classId,sectionId:draft.sectionId,date:draft.generatedAt});changed=draft.subjectConfigFingerprint!==this.ruleService.fingerprint(c,draft.sectionId);}catch{changed=true;}}
    return {subjects,requirements,capacity:{totalWeeklyTeachingSlots:total,allocatedSubjectPeriods:allocated,remainingFlexiblePeriods:Math.max(0,total-allocated),excessRequestedPeriods:Math.max(0,allocated-total)},changed};
  }
  async save(schoolId:string|null,data:any){
    this.school(schoolId);if(!Array.isArray(data.requirements))throw new BadRequestException('requirements must be an array.');
    const [subjects,template]=await Promise.all([this.prisma.classSubject.findMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId,isActive:true}}),this.timing(schoolId,data.academicYearId,data.classId)]);
    const valid=new Set(subjects.map((row:any)=>row.subjectId)),capacity=template.workingDays.length*template.slots.filter((slot:any)=>slot.type==='TEACHING').length,total=data.requirements.reduce((sum:number,row:any)=>sum+Number(row.weeklyPeriods||0),0);
    if(total>capacity)throw new BadRequestException(`Subject requirements need ${total} periods per week, but the timing template provides only ${capacity} teaching periods.`);
    for(const row of data.requirements){if(!valid.has(row.subjectId)||Number(row.weeklyPeriods)<1)throw new BadRequestException('Requirements need an active class subject and positive weekly periods.');if(!await this.prisma.teacherAcademicAssignment.findFirst({where:{teacherId:row.primaryTeacherId,schoolId,academicYearId:data.academicYearId,classId:data.classId,subjectId:row.subjectId,isActive:true,teacher:{status:'ACTIVE',user:{status:'ACTIVE'}}}}))throw new ForbiddenException('Teacher must be actively assigned to this class subject.');}
    return this.prisma.$transaction(async(tx:any)=>{for(const row of data.requirements)await tx.classSubject.updateMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId,subjectId:row.subjectId,isActive:true},data:{requiredPeriodsPerWeek:Number(row.weeklyPeriods),preferredPeriods:row.preferredSequences||[],preferredTeacherIds:[row.primaryTeacherId],allowConsecutive:Number(row.maxConsecutive)>1}});await tx.subjectTimetableRequirement.deleteMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId}});if(data.requirements.length)await tx.subjectTimetableRequirement.createMany({data:data.requirements.map((row:any)=>({subjectId:row.subjectId,primaryTeacherId:row.primaryTeacherId,weeklyPeriods:Number(row.weeklyPeriods),maxConsecutive:Number(row.maxConsecutive)||1,preferredSequences:row.preferredSequences||[],requiresConsecutive:!!row.requiresConsecutive,schoolId,academicYearId:data.academicYearId,classId:data.classId}))});await tx.timetableEntry.updateMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId,timetablePlan:{status:'DRAFT'}},data:{isAffected:true,conflictCode:'SUBJECT_CONFIGURATION_CHANGED'}});return{capacity,total};});
  }
  async generate(schoolId:string|null,data:any){return this.ruleService.generate(schoolId,data);}

  async plans(schoolId:string|null,query:any){this.school(schoolId);const plans=await this.prisma.timetablePlan.findMany({where:{schoolId,academicYearId:query.academicYearId,classId:query.classId,sectionId:query.sectionId},include:{entries:{include:{subject:true,teacher:{include:{user:{select:{id:true,firstName:true,lastName:true}}}},periodSlot:true}},template:{include:{slots:{orderBy:{sequence:'asc'}}}}},orderBy:{version:'desc'}});const ids=[...new Set<string>(plans.flatMap(plan=>((plan.supervisionEntries||[]) as any[]).map(entry=>String(entry.teacherId))))];const teachers=await this.prisma.teacher.findMany({where:{schoolId,id:{in:ids}},select:{id:true,user:{select:{firstName:true,lastName:true}}}});return plans.map(plan=>({...plan,supervisionEntries:((plan.supervisionEntries||[]) as any[]).map(entry=>({...entry,teacher:teachers.find(t=>t.id===entry.teacherId)}))}));}
  async publishAll(schoolId:string|null,data:any){this.school(schoolId);return this.ruleService.publishAll(schoolId,data);}
  async publish(schoolId:string|null,id:string){this.school(schoolId);const plan=await this.prisma.timetablePlan.findFirst({where:{id,schoolId},include:{entries:true}});if(!plan)throw new NotFoundException('Draft not found.');if(plan.entries.some(entry=>entry.conflictCode))throw new ConflictException('Resolve conflicts before publishing.');return this.ruleService.publish(schoolId,id);}

  async removeAll(schoolId:string|null,academicYearId:string) {
    this.school(schoolId);
    if(typeof academicYearId!=='string'||!academicYearId.trim())throw new BadRequestException('academicYearId is required.');
    const year=await this.prisma.academicYear.findFirst({where:{id:academicYearId,schoolId},select:{id:true}});
    if(!year)throw new NotFoundException('Academic year not found.');
    return this.prisma.$transaction(async tx=>{
      const where={schoolId,academicYearId};
      const entries=await tx.timetableEntry.deleteMany({where});
      const plans=await tx.timetablePlan.deleteMany({where});
      return {deletedPlans:plans.count,deletedEntries:entries.count};
    });
  }

  async remove(schoolId:string|null,id:string) {
    this.school(schoolId);
    const result = await this.prisma.timetablePlan.deleteMany({ where: { id, schoolId } });
    if (!result.count) throw new NotFoundException('Timetable plan not found.');
    return { id, deleted: true };
  }
}
