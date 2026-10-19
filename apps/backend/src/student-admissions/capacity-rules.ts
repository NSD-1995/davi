import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { id } from './admissions-rules';
const seats = z.number().int().positive().max(10000);
export const capacityPolicySchema = z.object({
  autoAssignOnJoin: z.boolean().default(true),
  defaultCapacity: seats.nullable().default(null),
  nearFullPercent: z.number().int().min(1).max(100).default(90),
  preference: z.enum(['BALANCED_COUNT', 'BALANCED_UTILIZATION']).default('BALANCED_COUNT'),
  rules: z.array(z.object({ academicYearId: id, level: z.enum(['ACADEMIC_LEVEL','GRADE','CLASSROOM','SECTION']), target: id, maximum: seats, reserved: z.number().int().min(0).max(9999).default(0) }).strict().refine(r => r.reserved < r.maximum, 'Reserved seats must be below maximum capacity.')).max(500).default([]),
  constraints: z.array(z.object({ academicYearId: id, enrollmentId: id, allowedSectionIds: z.array(id).max(100), preferredSectionIds: z.array(id).max(100).default([]) }).strict()).max(2000).default([]),
}).strict().superRefine((p,c) => {
  const keys=p.rules.map(r=>[r.academicYearId,r.level,r.target].join(':'));
  if(new Set(keys).size!==keys.length)c.addIssue({code:'custom',message:'Duplicate capacity policy scope.'});
  const ids=p.constraints.map(r=>r.academicYearId+':'+r.enrollmentId);
  if(new Set(ids).size!==ids.length)c.addIssue({code:'custom',message:'Duplicate student constraint.'});
});
export function effectiveCapacity(policy: any, schoolClass: any, section: any) {
  const matches = (policy?.rules || []).filter((r:any) => r.academicYearId === schoolClass.academicYearId && ({ACADEMIC_LEVEL:schoolClass.academicGroup,GRADE:schoolClass.id,CLASSROOM:section.room,SECTION:section.id} as any)[r.level] === r.target);
  // All applicable maxima are hard ceilings, including the physical room limit.
  const maxima = [section.capacity, policy?.defaultCapacity, ...matches.map((r:any)=>r.maximum)].filter((v:any)=>v != null);
  const maximum = maxima.length ? Math.min(...maxima) : null;
  const reserved = matches.reduce((n:number,r:any)=>Math.max(n,r.reserved || 0),0);
  return { maximum, reserved, capacity: maximum === null ? null : Math.max(0,maximum-reserved) };
}
export function capacityAllocation(students: any[], sections: any[], policy: any, yearId: string) {
  const planned=sections.map(s=>({...s,count:s.occupied}));
  if(planned.some(s=>s.capacity===null || s.capacity<s.occupied)) throw new BadRequestException('Configure valid capacity at least equal to existing placements, including reserved seats.');
  const constraints=new Map((policy?.constraints || []).filter((c:any)=>c.academicYearId===yearId).map((c:any)=>[c.enrollmentId,c]));
  const assignments:any[]=[],waitlist:any[]=[];
  // Most constrained first, then confirmed enrollment order; IDs break section ties.
  const ordered=students.map((s,i)=>({...s,order:i})).sort((a,b)=>((constraints.get(a.id) as any)?.allowedSectionIds.length ?? 100000)-((constraints.get(b.id) as any)?.allowedSectionIds.length ?? 100000)||a.order-b.order);
  for(const student of ordered){
    const rule:any=constraints.get(student.id);
    const candidates=planned.filter(s=>s.count<s.capacity && (!rule || rule.allowedSectionIds.includes(s.id)));
    candidates.sort((a,b)=>Number(Boolean(rule?.preferredSectionIds?.includes(b.id)))-Number(Boolean(rule?.preferredSectionIds?.includes(a.id))) || (policy?.preference==='BALANCED_UTILIZATION' ? a.count/Math.max(1,a.capacity)-b.count/Math.max(1,b.capacity) : a.count-b.count) || a.id.localeCompare(b.id));
    let target=candidates[0];
    // Find an augmenting path before declaring a shortage. Only proposals may move;
    // existing placements are never displaced by this search.
    if(!target){
      const visited=new Set<string>();
      const freeSeat=(section:any):boolean=>{
        if(visited.has(section.id))return false;
        visited.add(section.id);
        if(section.count<section.capacity)return true;
        for(const assignment of assignments.filter(a=>a.sectionId===section.id)){
          const restriction:any=constraints.get(assignment.enrollmentId);
          for(const alternative of planned.filter(s=>s.id!==section.id && (!restriction || restriction.allowedSectionIds.includes(s.id))).sort((a,b)=>a.count-b.count || a.id.localeCompare(b.id))){
            if(freeSeat(alternative)){assignment.sectionId=alternative.id;alternative.count++;section.count--;return true;}
          }
        }
        return false;
      };
      target=planned.filter(s=>!rule || rule.allowedSectionIds.includes(s.id)).find(freeSeat);
    }
    if(!target){waitlist.push({enrollmentId:student.id,version:student.version,reason:rule?'No eligible section has available seats.':'No available seats.'});continue;}
    target.count++;assignments.push({enrollmentId:student.id,version:student.version,sectionId:target.id});
  }
  return {assignments,waitlist,distribution:planned.map(s=>({sectionId:s.id,capacity:s.capacity,previouslyAssigned:s.occupied,proposedTotal:s.count,available:Math.max(0,s.capacity-s.count)}))};
}
export async function seatCapacity(tx:any,schoolId:string,academicYearId:string,classId:string,section:any){
  const [settings,schoolClass]=await Promise.all([tx.schoolSetting.findUnique({where:{schoolId}}),tx.schoolClass.findFirst({where:{id:classId,schoolId,academicYearId}})]);
  if(!schoolClass)throw new BadRequestException('Class does not belong to this school/year.');
  return effectiveCapacity(settings?.sectionCapacityPolicy,schoolClass,section).capacity;
}

/** Uses saved norms; never guesses a maximum or writes sections. */
export function sectionProposal(schoolClass:any,policy:any,demand:number,occupied:Record<string,number>={}){
  const sections=schoolClass.sections.filter((s:any)=>s.status==='ACTIVE').map((s:any)=>{
    const limit=effectiveCapacity(policy,schoolClass,s);
    if(limit.capacity===null || limit.capacity<(occupied[s.id] || 0))throw new BadRequestException('Configure valid capacity for '+schoolClass.name+' / '+s.name+'.');
    return {key:s.id,id:s.id,name:s.name,capacity:s.capacity ?? limit.maximum,usable:limit.capacity,occupied:occupied[s.id] || 0,expectedUpdatedAt:new Date(s.updatedAt).toISOString()};
  });
  const norm=effectiveCapacity(policy,schoolClass,{});
  const shortage=Math.max(0,demand-sections.reduce((n:number,s:any)=>n+s.usable,0));
  if(shortage>0 && (!norm.capacity || !norm.maximum))throw new BadRequestException('Set the maximum students per section for academic group '+(schoolClass.academicGroup || schoolClass.name)+' before generating sections.');
  const additional=shortage>0?Math.ceil(shortage/norm.capacity!):0;
  if(sections.length+additional>100)throw new BadRequestException('More than 100 sections would be required. Review the intake and capacity norms.');
  for(let index=0;sections.length<schoolClass.sections.filter((s:any)=>s.status==='ACTIVE').length+additional;index++){
    let value=index+1,name='';while(value){value--;name=String.fromCharCode(65+value%26)+name;value=Math.floor(value/26);}
    if(schoolClass.sections.some((s:any)=>s.name.toLowerCase()===name.toLowerCase()))continue;
    sections.push({key:'new-'+index,name,capacity:norm.maximum,usable:norm.capacity,occupied:0});
  }
  return sections;
}
