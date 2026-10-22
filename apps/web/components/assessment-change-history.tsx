'use client';
export function assessmentChanges(detail:any){
 const groups=new Map<string,any>();
 for(const h of detail.history||[]){
  const m=h.metadata||{},key=m.saveId||h.id,actorName=m.actorName||[h.actor?.firstName,h.actor?.lastName].filter(Boolean).join(' ')||'Staff member';
  let row=groups.get(key);
  if(!row){row={id:key,at:h.createdAt,actorName,students:new Set<string>(),subjects:new Set<string>(),action:h.action==='ASSESSMENT_MARKS_CHANGED'?'Saved draft':h.action==='ASSESSMENT_OBSERVATIONS_ADDED'?'Saved observation draft':h.action.replace(/^ASSESSMENT_/,'').replaceAll('_',' ')};groups.set(key,row);}
  for(const record of m.after||m.records||[]){if(record.enrollmentId)row.students.add(record.enrollmentId);if(record.competencyKey)row.subjects.add(record.competencyKey);}
  if(m.examSubjectId)row.subjects.add(m.examSubjectId);
 }
 return Array.from(groups.values());
}
export function AssessmentChangeHistory({detail}:{detail:any}){const rows=assessmentChanges(detail);return <details className="card"><summary>Assessment change history</summary><p>One entry per save, showing who saved and when.</p>{!rows.length?<p>No changes recorded yet.</p>:<div className="table-wrap"><table><thead><tr><th>Date & time</th><th>Changed by</th><th>Action</th><th>Summary</th></tr></thead><tbody>{rows.map((r:any)=><tr key={r.id}><td>{new Date(r.at).toLocaleString()}</td><td>{r.actorName}</td><td>{r.action}</td><td>{r.students.size>0? r.students.size+' student'+(r.students.size===1?'':'s')+' ? '+r.subjects.size+' subject / competency':''}</td></tr>)}</tbody></table></div>}</details>;}

