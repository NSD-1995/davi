// Published commitments and the latest draft per section reserve teachers.
// Historical drafts must not consume teacher capacity.
export function externalTimetablePlanIds(plans:{id:string;sectionId:string;status:string;generatedAt:Date;version:number}[]) {
  const ids=new Set<string>();
  const latest=new Set<string>();
  for(const plan of [...plans].sort((a,b)=>+new Date(b.generatedAt)-+new Date(a.generatedAt)||b.version-a.version)) {
    if(!['DRAFT','PUBLISHED'].includes(plan.status))continue;
    if(!latest.has(plan.sectionId)||plan.status==='PUBLISHED')ids.add(plan.id);
    latest.add(plan.sectionId);
  }
  return ids;
}
