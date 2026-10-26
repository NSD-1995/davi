export function studentHomeworkProgress(rows:any[]){
 const students=new Map<string,any>();
 for(const row of rows.filter(r=>r.status==='PUBLISHED'))for(const s of row.analysis?.students||[]){
  const p=students.get(s.enrollmentId)||{enrollmentId:s.enrollmentId,name:s.name,admissionNumber:s.admissionNumber,assigned:0,completed:0,pending:0,overdue:0,late:0,pendingHomework:[]};
  p.assigned++;if(s.completed)p.completed++;else{p.pending++;if(s.overdueDays>0)p.overdue++;p.pendingHomework.push({title:row.title,dueAt:row.dueAt,overdueDays:s.overdueDays||0});}if(s.completedLate)p.late++;
  students.set(s.enrollmentId,p);
 }
 return [...students.values()].map(s=>({...s,percentage:Math.round(s.completed/s.assigned*100)})).sort((a,b)=>b.overdue-a.overdue||b.pending-a.pending||a.name.localeCompare(b.name));
}
