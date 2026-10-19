import { createHash } from 'crypto';
export function sectionRollNumberPreview(students:any[],reserved:any[]=[]){
 const used=new Set<string>();let next=1;const errors:string[]=[];
 for(const row of [...students,...reserved]){const value=row.rollNumber?.trim();if(!value)continue;const key=/^\d+$/.test(value)?String(Number(value)):value.toLowerCase();if(used.has(key))errors.push('Duplicate existing roll number: '+value);used.add(key);if(/^\d+$/.test(value)){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)errors.push('Invalid existing roll number: '+value);else next=Math.max(next,n+1);}}
 const ordered=[...students].sort((a,b)=>{const name=(r:any)=>(r.student.user.firstName+' '+r.student.user.lastName).trim().replace(/\s+/g,' ');return name(a).localeCompare(name(b),'en',{sensitivity:'base'})||a.admissionNumber.localeCompare(b.admissionNumber,'en')||a.id.localeCompare(b.id);});
 const rows=ordered.map(row=>({enrollmentId:row.id,studentName:(row.student.user.firstName+' '+row.student.user.lastName).trim(),admissionNumber:row.admissionNumber,version:row.version,current:row.rollNumber || null,proposed:row.rollNumber?.trim()?row.rollNumber:String(next++),changed:!row.rollNumber?.trim()}));
 if(next>Number.MAX_SAFE_INTEGER)errors.push('Existing numeric roll numbers are too large.');
 return {rows,errors,changed:rows.filter(r=>r.changed).length,expectedPreview:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
}
