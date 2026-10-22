// Render immutable published snapshots. No external URLs are fetched during export.
const PDFDocument=require('pdfkit');
function imageData(value:unknown){if(typeof value!=='string'||value.length>2800000||!/^data:image\/(png|jpeg);base64,/.test(value))return null;return Buffer.from(value.slice(value.indexOf(',')+1),'base64');}
export async function assessmentPdf(snapshot:any):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margins:{top:48,left:48,right:48,bottom:70},bufferPages:true,info:{Title:snapshot.assessment.name,Author:snapshot.school.name}}),chunks:Buffer[]=[];
  doc.on('data',(chunk:Buffer)=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
  if(process.env.ASSESSMENT_PDF_FONT)doc.font(process.env.ASSESSMENT_PDF_FONT);
  const keep=(height:number)=>{if(doc.y+height>750)doc.addPage();};
  const line=(text:string,size=11)=>{doc.fontSize(size);keep(Math.min(650,doc.heightOfString(String(text||''),{width:499,lineGap:3})+5));doc.fillColor('#172d42').text(String(text||''),{lineGap:3});doc.moveDown(.15);};
  try{
   const logo=imageData(snapshot.school.logoUrl);if(logo){doc.image(logo,48,40,{fit:[55,55]});doc.y=105;}
   line(snapshot.school.name,20);if(snapshot.school.address)line(snapshot.school.address,9);
   line(snapshot.assessment.type==='MARKS'||snapshot.assessment.type==='GRADE'?'Academic Report Card':'Holistic Progress Card',17);
   line(snapshot.student.name,15);const photo=imageData(snapshot.student.photoUrl);if(photo)doc.image(photo,460,48,{fit:[75,85]});
   line(`${snapshot.student.yearName} | ${snapshot.student.className} / ${snapshot.student.sectionName}`);
   line(`Admission: ${snapshot.student.admissionNumber} | ${snapshot.assessment.name} | ${snapshot.assessment.termKey}`);
   doc.moveDown();
   for(const s of snapshot.subjects||[]){line(s.name,13);line(s.state==='PRESENT'?`Total: ${s.total??'Not applicable'}${s.maximum?' / '+s.maximum:''}${s.percentage!==null&&s.percentage!==undefined?' | Weighted: '+s.percentage+'%':''}${s.grade?' | Grade: '+s.grade:''}${s.passed===null||s.passed===undefined?'':s.passed?' | Meets pass criteria':' | Below pass criteria'}`:s.state);if(s.remarks)line(s.remarks);}
   for(const c of snapshot.competencies||[]){keep(110);line(c.domain+' / '+c.label,13);line(c.outcome);if(c.material)line('Material / activity: '+c.material,10);line('Development: '+c.rating);for(const o of c.history||[]){const rating=snapshot.assessment.config.ratings.find((r:any)=>r.key===o.rating)?.label||o.rating;line(`${String(o.observedOn).slice(0,10)} | ${rating} | ${o.remarks}`,10);if(o.evidence)line('Evidence: '+o.evidence,9);}}
   for(const term of snapshot.terms||[]){line(term.assessment.name+' / '+term.assessment.termKey,14);for(const c of term.competencies||[])line(c.domain+' / '+c.label+': '+c.rating);for(const s of term.subjects||[])line(s.name+': '+(s.percentage===null?s.state:s.percentage+'%')+(s.grade?' / '+s.grade:''));}
   if(snapshot.teacherComment){line('Teacher remarks',13);line(snapshot.teacherComment);}
   line('Approved '+String(snapshot.assessment.approvedAt||'').slice(0,10)+' | Report revision '+snapshot.assessment.revision,9);
   if(snapshot.assessment.principalName)line('Principal: '+snapshot.assessment.principalName,10);
   const signature=imageData(snapshot.assessment.signature);if(signature)doc.image(signature,{fit:[120,45]});
   const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.fontSize(8).fillColor('#56697a').text('DAVI | Published assessment | Page '+(i+1)+' of '+range.count,48,785,{lineBreak:false});}
   doc.end();
  }catch(e){doc.destroy();reject(e);}
 });
}
