const days=['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function substitutionExplanation(data:any):string[]{
 if(!data)return[];
 if(data.holiday)return['The selected date is a school holiday. There are no timetable periods requiring a substitute.'];
 const weekday=new Date(data.date+'T12:00:00Z').getUTCDay()||7;
 const noPeriods=new Map<string,{names:string[];workingDays:number[]}>();
 const messages=(data.teachers||[]).filter((t:any)=>t.approvedLeave||['ABSENT','ON_LEAVE','HALF_DAY'].includes(t.attendance?.recordStatus||t.attendance?.status)).flatMap((t:any)=>{
  const d=t.coverDiagnostics;if(!d)return[];
  if(!d.publishedTimetables)return[t.name+' has confirmed unavailability but no published teaching timetable. Publish the relevant class timetable first.'];
  if(!d.scheduledLessons){const workingDays=[...d.workingDays].sort((a:number,b:number)=>a-b),key=workingDays.join(',');const group:{names:string[];workingDays:number[]}=noPeriods.get(key)||{names:[],workingDays};group.names.push(t.name);noPeriods.set(key,group);return[];}
  if(d.affectedLessons&&!d.remainingAffectedLessons)return[t.name+': all affected timetable periods for '+data.date+' have ended in the school timezone. New substitutes cannot be assigned retroactively.'];
  if(!d.affectedLessons)return[t.name+': no timetable periods overlap the confirmed unavailable interval.'];
  return[];
 });
 noPeriods.forEach(group=>messages.push('No periods are assigned in the published timetable on '+days[weekday]+' ('+data.date+') for '+group.names.join(', ')+'. Timetable working days: '+group.workingDays.map(day=>days[day]).join(', ')+'. No substitution is needed for these staff on this date.'));
 return messages;
}
