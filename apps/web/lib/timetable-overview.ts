export function latestSectionPlans(plans:any[]){
 const latest=new Map<string,any>();
 for(const plan of [...plans].sort((a,b)=>new Date(b.generatedAt||0).getTime()-new Date(a.generatedAt||0).getTime()||b.version-a.version))if(!latest.has(plan.sectionId))latest.set(plan.sectionId,plan);
 return latest;
}

export function timetableConflicts(plans:any[],classes:any[]){
 const issues:Record<string,any[]>={};
 const labels=new Map<string,string>(classes.flatMap(c=>c.sections.map((s:any)=>[s.id,`${c.name} / Section ${s.name}`])));
 const add=(plan:any,entry:any,message:string,code='TEACHER_CONFLICT')=>{(issues[plan.id]||=[]).push({code,message,sectionId:plan.sectionId,weekday:entry.weekday,periodSlotId:entry.periodSlotId,teacherId:entry.teacherId});};
 const bookings:any[]=[];
 for(const plan of latestSectionPlans(plans).values()){
  if(!['DRAFT','PUBLISHED'].includes(plan.status))continue;
  for(const entry of [...plan.entries,...(plan.supervisionEntries||[])]){
   const slot=plan.template?.slots.find((s:any)=>s.id===entry.periodSlotId);if(!slot)continue;
   if(entry.conflictCode)add(plan,entry,String(entry.conflictCode).replace(/_/g,' '),entry.conflictCode);
   for(const other of bookings){if(entry.weekday!==other.entry.weekday||slot.startTime>=other.slot.endTime||other.slot.startTime>=slot.endTime)continue;
    const sameSection=plan.sectionId===other.plan.sectionId;
    if(!sameSection&&entry.teacherId!==other.entry.teacherId)continue;
    const name=entry.teacher?.user?[entry.teacher.user.firstName,entry.teacher.user.lastName].join(' '):other.entry.teacher?.user?[other.entry.teacher.user.firstName,other.entry.teacher.user.lastName].join(' '):'Assigned teacher';
    const day=['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][entry.weekday];
    const message=sameSection?`${labels.get(plan.sectionId)} has overlapping periods on ${day}, ${slot.startTime}–${slot.endTime}.`:`${name} overlaps between ${labels.get(plan.sectionId)} and ${labels.get(other.plan.sectionId)} on ${day}, ${slot.startTime}–${slot.endTime}.`;
    add(plan,entry,message,sameSection?'SECTION_CONFLICT':'TEACHER_CONFLICT');add(other.plan,other.entry,message,sameSection?'SECTION_CONFLICT':'TEACHER_CONFLICT');
   }
   bookings.push({plan,entry,slot});
  }
 }
 return issues;
}
