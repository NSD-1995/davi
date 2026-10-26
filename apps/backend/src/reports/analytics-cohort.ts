import { localClock } from '../timetable/coverage.service';
export function locationOn(enrollment:any,date:string,timeZone:string){
 const moves=enrollment.movements||[],later=moves.find((m:any)=>localClock(new Date(m.createdAt),timeZone).date>date);
 if(later)return {classId:later.fromClassId||enrollment.classId,sectionId:later.fromSectionId};
 const previous=[...moves].reverse().find((m:any)=>localClock(new Date(m.createdAt),timeZone).date<=date);
 return previous?{classId:previous.toClassId,sectionId:previous.toSectionId}:{classId:enrollment.classId,sectionId:enrollment.sectionId};
}
export function matchesLocation(location:any,filters:any,branches:any[]){return (!filters.classId||filters.classId===location.classId)&&(!filters.sectionId||filters.sectionId===location.sectionId)&&branches.some(b=>(!b.classId||b.classId===location.classId)&&(!b.sectionId||b.sectionId===location.sectionId));}
export function academicAllowed(location:any,subjectId:string,filters:any,branches:any[]){return (!filters.subjectId||filters.subjectId===subjectId)&&matchesLocation(location,filters,branches)&&branches.some(b=>(!b.classId||b.classId===location.classId)&&(!b.sectionId||b.sectionId===location.sectionId)&&(!b.subjectId||b.subjectId===subjectId));}
export function historicalScope(branch:any){const clauses:any[]=[];if(branch.classId)clauses.push({OR:[{classId:branch.classId},{movements:{some:{OR:[{fromClassId:branch.classId},{toClassId:branch.classId}]}}}]});if(branch.sectionId)clauses.push({OR:[{sectionId:branch.sectionId},{movements:{some:{OR:[{fromSectionId:branch.sectionId},{toSectionId:branch.sectionId}]}}}]});return clauses.length?{AND:clauses}:{};}
