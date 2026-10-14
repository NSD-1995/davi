export const ACADEMIC_GROUPS = [
  {id:'MONTESSORI',label:'Montessori',range:'Play School to UKG'},
  {id:'PRE_PRIMARY',label:'Pre-primary',range:'1–2'},
  {id:'PRIMARY',label:'Primary',range:'3–5'},
  {id:'MIDDLE',label:'Middle School',range:'6–8'},
  {id:'SECONDARY',label:'Secondary',range:'9–10'},
  {id:'SENIOR_SECONDARY',label:'Senior Secondary',range:'11–12'},
] as const;
export function academicGroup(c:{name?:string;academicGroup?:string|null}):string|null {
  if(c.academicGroup)return c.academicGroup;
  const name=(c.name||'').trim();
  if(/montessori|play\s*school|nursery|\blkg\b|\bukg\b/i.test(name))return 'MONTESSORI';
  const n=Number(name.match(/^(?:class\s*|grade\s*)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:standard|class|grade))?$/i)?.[1]);
  return n>=1&&n<=2?'PRE_PRIMARY':n<=5&&n>=3?'PRIMARY':n<=8&&n>=6?'MIDDLE':n<=10&&n>=9?'SECONDARY':n<=12&&n>=11?'SENIOR_SECONDARY':null;
}
export function validGroups(value:unknown):value is string[]{return Array.isArray(value)&&value.every(id=>ACADEMIC_GROUPS.some(g=>g.id===id))&&new Set(value).size===value.length;}
export function subjectInGroup(subject:{academicGroups?:string[]},group:string|null){return !subject.academicGroups?.length||!!group&&subject.academicGroups.includes(group);}

export function configuredAcademicGroups(classes:{name?:string;academicGroup?:string|null;status?:string;academicYearId?:string|null}[],yearId?:string|null){
  const ids=new Set(classes.filter(c=>c.status!=='INACTIVE'&&(!yearId||c.academicYearId===yearId)).map(academicGroup));
  return ACADEMIC_GROUPS.filter(group=>ids.has(group.id));
}

export function subjectInConfiguredGroups(subject:{academicGroups?:string[]},groups:readonly {id:string}[]){
  return !subject.academicGroups?.length||groups.some(group=>subject.academicGroups!.includes(group.id));
}
