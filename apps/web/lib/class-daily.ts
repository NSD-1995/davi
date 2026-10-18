export function dailyAttendance(students: Array<{id:string}>, rows: Array<{enrollmentId:string;status:string}>) {
 const ids=new Set(students.map(s=>s.id));
 const valid=[...new Map(rows.filter(r=>ids.has(r.enrollmentId)).map(r=>[r.enrollmentId,r])).values()];
 const count=(status:string)=>valid.filter(r=>r.status===status).length;
 return {total:students.length,recorded:valid.length,present:count('PRESENT'),absent:count('ABSENT'),late:count('LATE'),notMarked:Math.max(0,students.length-valid.length),percentage:valid.length?Math.round(count('PRESENT')/valid.length*1000)/10:null};
}
export function schoolNow(timeZone:string, now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
export function periodPhase(date:string,start:string,end:string,clock:{date:string;time:string}) {return date<clock.date?'Completed':date>clock.date?'Upcoming':clock.time>=end?'Completed':clock.time>=start?'Current':'Upcoming';}
