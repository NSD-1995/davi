import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { generateSlots, validateSlots } from './period-template.generator';
@Injectable()
export class PeriodTemplatesService {
  constructor(private p: PrismaService) {}
  private school(s: string | null): asserts s is string { if (!s) throw new ForbiddenException('A school account is required.'); }
  private dates(a: any, b: any) { const f = new Date(a), t = b ? new Date(b) : null; if (Number.isNaN(+f) || (t && t < f)) throw new BadRequestException('Effective-to must be on or after effective-from.'); return [f, t] as const; }
  private minutes(v: string) { const [h,m] = v.split(':').map(Number); return h * 60 + m; }
  preview(d: any) {
    const slots = d.method === 'QUICK'
      ? generateSlots(d.quick)
      : validateSlots(d.slots, d.workingDays, d.schoolStartTime, d.schoolEndTime);
    return slots.map(s => ({ ...s, duration: this.minutes(s.endTime) - this.minutes(s.startTime) }));
  }
  async create(s: string | null, u: string, d: any) {
    this.school(s); if (!await this.p.academicYear.findFirst({ where: { id: d.academicYearId, schoolId: s } })) throw new NotFoundException('Academic year not found for your school.');
    const [from,to] = this.dates(d.effectiveFrom,d.effectiveTo), slots = this.preview(d).filter((slot:any)=>slot.type!=='UNALLOCATED');
    return this.p.$transaction((tx:any) => tx.periodTimingTemplate.create({ data: { schoolId:s,academicYearId:d.academicYearId,familyId:randomUUID(),name:d.name.trim(),description:d.description||null,workingDays:d.workingDays,schoolStartTime:d.schoolStartTime,schoolEndTime:d.schoolEndTime,effectiveFrom:from,effectiveTo:to,createdById:u,updatedById:u,slots:{create:slots.map((v:any,index:number)=>({name:v.name,type:v.type,sequence:index+1,startTime:v.startTime,endTime:v.endTime,applicableDays:v.applicableDays,shortCode:v.shortCode??null,attendanceEnabled:!!v.attendanceEnabled}))} }, include:{slots:true,assignments:true} }));
  }
  list(s:string|null,y?:string){this.school(s);return this.p.periodTimingTemplate.findMany({where:{schoolId:s,...(y?{academicYearId:y}:{})},include:{_count:{select:{slots:true,assignments:true}}},orderBy:[{name:'asc'},{version:'desc'}]});}
  async one(s:string|null,id:string){this.school(s);const x=await this.p.periodTimingTemplate.findFirst({where:{id,schoolId:s},include:{slots:{orderBy:{sequence:'asc'}},assignments:{include:{schoolClass:true,section:true}},createdBy:{select:{firstName:true,lastName:true}},updatedBy:{select:{firstName:true,lastName:true}}}});if(!x)throw new NotFoundException('Period timing template not found.');const teaching=x.slots.filter((slot:any)=>slot.type==='TEACHING'),first=teaching[0];return{...x,teachingPeriods:teaching.length,teachingDuration:first?this.minutes(first.endTime)-this.minutes(first.startTime):30,reservedSlots:x.slots.filter((slot:any)=>slot.type!=='TEACHING'&&slot.type!=='UNALLOCATED')};}
  async affected(s:string|null,id:string){const template=await this.one(s,id);const entries=await this.p.timetableEntry.findMany({where:{schoolId:s!,periodSlot:{templateId:id}},include:{schoolClass:true,section:true,subject:true,periodSlot:true}});return{published:entries.some((e:any)=>e.timetableDate&&e.timetableDate<new Date()),count:entries.length,entries,template};}
  async update(s:string|null,u:string,id:string,d:any){
    const x=await this.one(s,id);
    const[from,to]=this.dates(d.effectiveFrom??x.effectiveFrom,d.effectiveTo??x.effectiveTo);
    const slots=d.slots?validateSlots(d.slots,d.workingDays??x.workingDays,d.schoolStartTime??x.schoolStartTime,d.schoolEndTime??x.schoolEndTime):x.slots;
    return this.p.$transaction(async(tx:any)=>{
      if(d.slots){
        await tx.periodTimingSlot.deleteMany({where:{templateId:id}});
        await tx.periodTimingSlot.createMany({data:slots.map((v:any,index:number)=>({
          templateId:id,
          name:v.name,
          type:v.type,
          sequence:index+1,
          startTime:v.startTime,
          endTime:v.endTime,
          applicableDays:v.applicableDays,
          shortCode:v.shortCode??null,
          attendanceEnabled:!!v.attendanceEnabled,
        }))});
      }
      return tx.periodTimingTemplate.update({where:{id},data:{name:d.name??x.name,description:d.description??x.description,workingDays:d.workingDays??x.workingDays,schoolStartTime:d.schoolStartTime??x.schoolStartTime,schoolEndTime:d.schoolEndTime??x.schoolEndTime,effectiveFrom:from,effectiveTo:to,updatedById:u},include:{slots:true,assignments:true}});
    });
  }
  async status(s:string|null,u:string,id:string,status:string){const x=await this.one(s,id);if(!['ACTIVE','INACTIVE','ARCHIVED'].includes(status))throw new BadRequestException('Invalid template status.');if(status==='ACTIVE')validateSlots(x.slots.map((v:any)=>({...v,shortCode:v.shortCode??undefined})),x.workingDays,x.schoolStartTime,x.schoolEndTime);return this.p.periodTimingTemplate.update({where:{id},data:{status,updatedById:u}});}
  async version(s:string|null,u:string,id:string,effectiveFrom:string){const x=await this.one(s,id),[from]=this.dates(effectiveFrom,null);return this.p.periodTimingTemplate.create({data:{schoolId:x.schoolId,academicYearId:x.academicYearId,familyId:x.familyId,name:x.name,description:x.description,workingDays:x.workingDays,schoolStartTime:x.schoolStartTime,schoolEndTime:x.schoolEndTime,effectiveFrom:from,status:'DRAFT',version:x.version+1,createdById:u,updatedById:u,slots:{create:x.slots.map((v:any)=>({name:v.name,type:v.type,sequence:v.sequence,startTime:v.startTime,endTime:v.endTime,applicableDays:v.applicableDays,shortCode:v.shortCode,attendanceEnabled:v.attendanceEnabled}))},assignments:{create:x.assignments.map((a:any)=>({schoolId:a.schoolId,academicYearId:a.academicYearId,classId:a.classId,sectionId:a.sectionId,effectiveFrom:from,isActive:true}))}},include:{slots:true,assignments:true}});}
  async assign(s:string|null,id:string,d:any){const x=await this.one(s,id),[from,to]=this.dates(d.effectiveFrom??x.effectiveFrom,d.effectiveTo??x.effectiveTo),ids=[...new Set<string>(d.classIds||[])];if(!ids.length)throw new BadRequestException('Select at least one class.');const classes=await this.p.schoolClass.findMany({where:{id:{in:ids},schoolId:s!,academicYearId:x.academicYearId}});if(classes.length!==ids.length)throw new ForbiddenException('Every class must belong to this school and academic year.');for(const classId of ids){if(await this.p.periodTemplateAssignment.findFirst({where:{schoolId:s!,academicYearId:x.academicYearId,classId,sectionId:d.sectionId??null,isActive:true,effectiveFrom:{lte:to??new Date('9999-12-31')},OR:[{effectiveTo:null},{effectiveTo:{gte:from}}]}}))throw new ConflictException('A class already has an active timing template covering this date range.');}return this.p.periodTemplateAssignment.createMany({data:ids.map(classId=>({schoolId:s!,academicYearId:x.academicYearId,templateId:id,classId,sectionId:d.sectionId??null,effectiveFrom:from,effectiveTo:to}))});}
  async unassign(s:string|null,id:string,a:string){await this.one(s,id);const row=await this.p.periodTemplateAssignment.findFirst({where:{id:a,templateId:id,schoolId:s!}});if(!row)throw new NotFoundException('Assignment not found.');return this.p.periodTemplateAssignment.update({where:{id:a},data:{isActive:false,effectiveTo:new Date()}});}
  async resolve(s:string|null,y:string,c:string,section:string|undefined,dateValue:string){this.school(s);const date=new Date(dateValue);if(Number.isNaN(+date))throw new BadRequestException('A valid timetable date is required.');const rows=await this.p.periodTemplateAssignment.findMany({where:{schoolId:s,academicYearId:y,classId:c,isActive:true,effectiveFrom:{lte:date},AND:[{OR:[{effectiveTo:null},{effectiveTo:{gte:date}}]},{OR:[{sectionId:section},{sectionId:null}]}],template:{status:'ACTIVE'}},include:{template:{include:{slots:{orderBy:{sequence:'asc'}}}}}});const row=rows.find((r:any)=>r.sectionId===section)||rows.find((r:any)=>r.sectionId===null);if(!row)throw new NotFoundException('A period timing template has not been assigned to this class. Configure timings before creating the timetable.');return row.template;}
}
