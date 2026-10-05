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
        const previous=subjectDay.at(-1);
        const consecutive=previous&&slots.find(item=>item.id===previous.periodSlotId)?.sequence+1===slot.sequence;
        if(consecutive&&subjectDay.length>=(requirement.maxConsecutive||1))continue;
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
  constructor(private readonly prisma:PrismaService) {}
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
    const total=template.workingDays.length*template.slots.filter((slot:any)=>slot.type==='TEACHING').length;
    const allocated=subjects.reduce((sum:number,row:any)=>sum+row.requiredPeriodsPerWeek,0);
    return {subjects,requirements,capacity:{totalWeeklyTeachingSlots:total,allocatedSubjectPeriods:allocated,remainingFlexiblePeriods:Math.max(0,total-allocated),excessRequestedPeriods:Math.max(0,allocated-total)},changed:!!draft&&draft.subjectConfigFingerprint!==this.fingerprint(requirements)};
  }
  async save(schoolId:string|null,data:any){
    this.school(schoolId);if(!Array.isArray(data.requirements))throw new BadRequestException('requirements must be an array.');
    const [subjects,template]=await Promise.all([this.prisma.classSubject.findMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId,isActive:true}}),this.timing(schoolId,data.academicYearId,data.classId)]);
    const valid=new Set(subjects.map((row:any)=>row.subjectId)),capacity=template.workingDays.length*template.slots.filter((slot:any)=>slot.type==='TEACHING').length,total=data.requirements.reduce((sum:number,row:any)=>sum+Number(row.weeklyPeriods||0),0);
    if(total>capacity)throw new BadRequestException(`Subject requirements need ${total} periods per week, but the timing template provides only ${capacity} teaching periods.`);
    for(const row of data.requirements){if(!valid.has(row.subjectId)||Number(row.weeklyPeriods)<1)throw new BadRequestException('Requirements need an active class subject and positive weekly periods.');if(!await this.prisma.teacher.findFirst({where:{id:row.primaryTeacherId,schoolId,status:'ACTIVE'}}))throw new ForbiddenException('Teacher is not active in this school.');}
    return this.prisma.$transaction(async(tx:any)=>{await tx.subjectTimetableRequirement.deleteMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId}});if(data.requirements.length)await tx.subjectTimetableRequirement.createMany({data:data.requirements.map((row:any)=>({subjectId:row.subjectId,primaryTeacherId:row.primaryTeacherId,weeklyPeriods:Number(row.weeklyPeriods),maxConsecutive:Number(row.maxConsecutive)||1,preferredSequences:row.preferredSequences||[],requiresConsecutive:!!row.requiresConsecutive,schoolId,academicYearId:data.academicYearId,classId:data.classId}))});await tx.timetableEntry.updateMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId,timetablePlan:{status:'DRAFT'}},data:{isAffected:true,conflictCode:'SUBJECT_CONFIGURATION_CHANGED'}});return{capacity,total};});
  }
  async generate(schoolId:string|null,data:any){
    this.school(schoolId);const date=new Date(data.date);if(Number.isNaN(+date))throw new BadRequestException('A valid generation date is required.');
    const [template,configured,subjects,section,teacherAssignments]=await Promise.all([
      this.timing(schoolId,data.academicYearId,data.classId,date),
      this.prisma.subjectTimetableRequirement.findMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId}}),
      this.prisma.classSubject.findMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId,isActive:true,subject:{status:'ACTIVE'}},orderBy:{displayOrder:'asc'}}),
      this.prisma.section.findFirst({where:{id:data.sectionId,schoolId,classId:data.classId,status:'ACTIVE'}}),
      this.prisma.teacherAcademicAssignment.findMany({where:{schoolId,academicYearId:data.academicYearId,classId:data.classId,sectionId:data.sectionId,assignmentRole:'PRIMARY',subjectId:{not:null},isActive:true}}),
    ]);
    if(!section)throw new BadRequestException('Section must be active and belong to the selected class.');
    if(!subjects.length)throw new BadRequestException('Assign at least one active subject to this class before generating its timetable.');
    const teachingSlots=template.slots.filter((slot:any)=>slot.type==='TEACHING'),weeklyCapacity=template.workingDays.length*teachingSlots.length,teacherBySubject=new Map(teacherAssignments.map((row:any)=>[row.subjectId,row.teacherId]));
    const configuredBySubject=new Map(configured.map((row:any)=>[row.subjectId,row]));
    const requested=subjects.reduce((sum:number,row:any)=>sum+row.requiredPeriodsPerWeek,0),autoFill=requested<=subjects.length;
    let remaining=weeklyCapacity;
    const requirements=subjects.map((row:any,index:number)=>{const saved:any=configuredBySubject.get(row.subjectId),teacherId=teacherBySubject.get(row.subjectId);const periods=autoFill?Math.floor(weeklyCapacity/subjects.length)+(index<weeklyCapacity%subjects.length?1:0):row.requiredPeriodsPerWeek;remaining-=periods;return{subjectId:row.subjectId,primaryTeacherId:teacherId,weeklyPeriods:periods,preferredSequences:saved?.preferredSequences||[],maxPeriodsPerDay:row.maxPeriodsPerDay||periods,maxConsecutive:row.maxConsecutive||1,requiresConsecutive:row.requiresConsecutive};});
    if(requirements.some(row=>!row.primaryTeacherId))throw new BadRequestException('Assign one active primary teacher for every class subject in this section before generating the timetable.');
    if(remaining<0)throw new BadRequestException(`Subject requirements need ${weeklyCapacity-remaining} periods per week, but the timing template provides only ${weeklyCapacity} teaching periods.`);
    const foreign=await this.prisma.timetableEntry.findMany({where:{schoolId,academicYearId:data.academicYearId,sectionId:{not:data.sectionId},timetablePlan:{status:{in:['DRAFT','PUBLISHED']}}},include:{periodSlot:true}}),blocked=new Set<string>();
    for(const requirement of requirements)for(const weekday of template.workingDays)for(const slot of teachingSlots)for(const entry of foreign)if(entry.weekday===weekday&&entry.periodSlot&&rangesOverlap(slot.startTime,slot.endTime,entry.periodSlot.startTime,entry.periodSlot.endTime)){if(entry.teacherId===requirement.primaryTeacherId)blocked.add(`${requirement.primaryTeacherId}:${weekday}:${slot.id}`);if(section.room&&entry.room===section.room)blocked.add(`ROOM:${weekday}:${slot.id}`);}
    const result=allocate(requirements,template.workingDays,teachingSlots,blocked),latest=await this.prisma.timetablePlan.findFirst({where:{schoolId,academicYearId:data.academicYearId,sectionId:data.sectionId},orderBy:{version:'desc'}});
    return this.prisma.$transaction(async(tx:any)=>{const plan=await tx.timetablePlan.create({data:{schoolId,academicYearId:data.academicYearId,classId:data.classId,sectionId:data.sectionId,templateId:template.id,version:(latest?.version||0)+1,subjectConfigFingerprint:this.fingerprint(requirements)}});if(result.entries.length)await tx.timetableEntry.createMany({data:result.entries.map(entry=>({...entry,schoolId,academicYearId:data.academicYearId,classId:data.classId,sectionId:data.sectionId,timetablePlanId:plan.id,timetableDate:date,room:section.room,conflictCode:result.conflicts.find(code=>code.includes(entry.subjectId))||null}))});return{...plan,conflicts:result.conflicts};});
  }
  plans(schoolId:string|null,query:any){this.school(schoolId);return this.prisma.timetablePlan.findMany({where:{schoolId,academicYearId:query.academicYearId,classId:query.classId,sectionId:query.sectionId},include:{entries:{include:{subject:true,teacher:{include:{user:true}},periodSlot:true}},template:{include:{slots:{orderBy:{sequence:'asc'}}}}},orderBy:{version:'desc'}});}
  async publish(schoolId:string|null,id:string){this.school(schoolId);const plan=await this.prisma.timetablePlan.findFirst({where:{id,schoolId},include:{entries:{include:{periodSlot:true}}}});if(!plan)throw new NotFoundException('Draft not found.');if(plan.entries.some((entry:any)=>entry.conflictCode))throw new ConflictException('Resolve conflicts before publishing.');if(plan.status&&plan.status!=='DRAFT')throw new ConflictException('Only a draft timetable can be published.');const other=await this.prisma.timetableEntry.findMany({where:{schoolId,academicYearId:plan.academicYearId,sectionId:{not:plan.sectionId},timetablePlan:{status:'PUBLISHED'}},include:{periodSlot:true}});for(const entry of plan.entries)if(other.some((existing:any)=>existing.teacherId===entry.teacherId&&existing.weekday===entry.weekday&&existing.periodSlot&&entry.periodSlot&&rangesOverlap(entry.periodSlot.startTime,entry.periodSlot.endTime,existing.periodSlot.startTime,existing.periodSlot.endTime)))throw new ConflictException('A teacher is already assigned to an overlapping period in another published timetable.');return this.prisma.$transaction(async(tx:any)=>{await tx.timetablePlan.updateMany({where:{schoolId,academicYearId:plan.academicYearId,sectionId:plan.sectionId,status:'PUBLISHED'},data:{status:'ARCHIVED'}});return tx.timetablePlan.update({where:{id},data:{status:'PUBLISHED',publishedAt:new Date()}});});}
}
