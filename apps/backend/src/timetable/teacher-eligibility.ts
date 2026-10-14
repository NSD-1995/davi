import {teachingExclusion} from '../teaching-responsibilities';
export function allowedForClass(teacher:{timetableEligibility?:unknown},classId:string,schoolClass?:{name?:string;academicGroup?:string|null}):boolean{
 return !teachingExclusion(teacher as any,classId,schoolClass||{});
}
