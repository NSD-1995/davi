import {academicGroup,subjectInGroup,validGroups} from './academic-groups';

export type GroupResponsibility={groupId:string;subjectIds:string[];classIds:string[]|null};
export type TeachingProfile={capableSubjectIds?:string[];timetableEligibility?:any};
export type TeachingClass={id?:string;name?:string;academicGroup?:string|null};

export function responsibilityRows(teacher:TeachingProfile,subjects:Array<{id:string;academicGroups?:string[]}>,classes:TeachingClass[]):GroupResponsibility[]{
 const policy=teacher.timetableEligibility||{};
 if(Array.isArray(policy.groupResponsibilities))return policy.groupResponsibilities;
 const groups=policy.academicGroups?.length?policy.academicGroups:['MONTESSORI','PRE_PRIMARY','PRIMARY','MIDDLE','SECONDARY','SENIOR_SECONDARY'];
 return groups.map((groupId:string)=>({groupId,subjectIds:(teacher.capableSubjectIds||[]).filter(id=>{const subject=subjects.find(s=>s.id===id);return subject&&subjectInGroup(subject,groupId)}),classIds:Array.isArray(policy.allowedClassIds)?policy.allowedClassIds.filter((id:string)=>classes.some(c=>c.id===id&&academicGroup(c)===groupId)):null}));
}
export function responsibilityError(rows:unknown,subjects:Array<{id:string;academicGroups?:string[]}>,classes:TeachingClass[]):string|null{
 if(!Array.isArray(rows))return 'Teaching responsibilities must be a list.';
 const groups:string[]=[];
 for(const row of rows){
  if(!row||!validGroups([row.groupId])||groups.includes(row.groupId))return 'Choose each academic group only once.';
  groups.push(row.groupId);
  if(!Array.isArray(row.subjectIds)||row.subjectIds.some((id:unknown)=>typeof id!=='string')||new Set(row.subjectIds).size!==row.subjectIds.length)return 'Select unique responsible subjects.';
  if(row.subjectIds.some((id:string)=>!subjects.some(s=>s.id===id&&subjectInGroup(s,row.groupId))))return 'Responsible subjects must belong to the selected academic group and school.';
  if(row.classIds!==null&&(!Array.isArray(row.classIds)||row.classIds.some((id:unknown)=>typeof id!=='string')||new Set(row.classIds).size!==row.classIds.length))return 'Choose all group classes or a list of unique classes.';
  if(row.classIds?.some((id:string)=>!classes.some(c=>c.id===id&&academicGroup(c)===row.groupId)))return 'Responsible classes must belong to the selected academic group and school.';
 }
 return null;
}
export function teachingExclusion(teacher:TeachingProfile,classId:string,schoolClass:TeachingClass,subjectId?:string):string|null{
 const policy=teacher.timetableEligibility||{},group=academicGroup(schoolClass);
 if(Array.isArray(policy.groupResponsibilities)){
  const row:GroupResponsibility|undefined=policy.groupResponsibilities.find((r:GroupResponsibility)=>r.groupId===group);
  if(!row)return 'Not responsible for this academic group';
  if(row.classIds!==null&&!row.classIds.includes(classId))return 'Class is outside this group responsibility';
  if(subjectId&&!row.subjectIds.includes(subjectId))return 'Subject is not assigned in this academic group';
 }else if(policy.academicGroups?.length&&!policy.academicGroups.includes(group))return 'Not responsible for this academic group';
 if(Array.isArray(policy.allowedClassIds)&&!policy.allowedClassIds.includes(classId))return 'Class is not allowed';
 if(subjectId&&!teacher.capableSubjectIds?.includes(subjectId))return 'Subject capability missing';
 return null;
}
