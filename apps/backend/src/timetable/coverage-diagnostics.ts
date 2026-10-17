// Per-person diagnostics can be returned with the already scoped teacher roster.
export function coverDiagnostics(context:any,teacherId:string){
 const plans=context.plans.filter((p:any)=>p.entries.some((e:any)=>e.teacherId===teacherId)||(p.supervisionEntries||[]).some((e:any)=>e.teacherId===teacherId));
 const lessons=context.scheduled.filter((t:any)=>t.teacherId===teacherId),affected=context.targets.filter((t:any)=>t.teacherId===teacherId);
 return{publishedTimetables:plans.length,workingDays:[...new Set<number>(plans.flatMap((p:any)=>p.template.workingDays))].sort((a,b)=>a-b),scheduledLessons:lessons.length,affectedLessons:affected.length,remainingAffectedLessons:affected.filter((t:any)=>t.endTime>context.currentTime).length};
}
