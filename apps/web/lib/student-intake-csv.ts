import { normalizeImportDate } from './import-date';
/** RFC-style quoted CSV; headers are explicit so class eligibility is reviewable. */
export const intakeFields=['firstName','lastName','className','parentName','mobile','dateOfBirth','gender','admissionNumber','fatherName','fatherMobile','motherName','motherMobile','parentEmail','address'];
export function suggestIntakeField(heading:string){
 const key=heading.toLowerCase().replace(/[^a-z]/g,'');
 const aliases:Record<string,string>={firstname:'firstName',studentfirstname:'firstName',studentname:'firstName',fullname:'firstName',nameofstudent:'firstName',childname:'firstName',name:'firstName',lastname:'lastName',surname:'lastName',class:'className',classname:'className',grade:'className',standard:'className',std:'className',parentname:'parentName',guardianname:'parentName',parentguardianname:'parentName',fathername:'fatherName',fathersname:'fatherName',fathermobile:'fatherMobile',fathermobilenumber:'fatherMobile',mothername:'motherName',mothermobile:'motherMobile',mothermobilenumber:'motherMobile',admissionnumber:'admissionNumber',admissionno:'admissionNumber',parentemail:'parentEmail',email:'parentEmail',address:'address',mobile:'mobile',parentmobile:'mobile',mobilenumber:'mobile',mobileno:'mobile',contactnumber:'mobile',phone:'mobile',phonenumber:'mobile',dob:'dateOfBirth',dateofbirth:'dateOfBirth',birthdate:'dateOfBirth',gender:'gender',sex:'gender'};
 return aliases[key] || (/^extra\.[a-z][a-zA-Z0-9_]{0,40}$/.test(heading)?heading:'');
}
export function parseStudentIntakeCsv(source:string,mapping:Record<string,string>={},allowInvalidRows=false){
 if(source.length>1000000)throw new Error('Upload a CSV smaller than 1 MB.');
 const records:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 const input=source.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){if(ch==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch==='"'){if(cell || closed)throw new Error('Invalid CSV quotation.');quoted=true;continue;}
  if(ch===',' || ch==='\n' || ch==='\r'){
   row.push(cell.trim());cell='';closed=false;
   if(ch!==','){if(ch==='\r' && input[i+1]==='\n')i++;if(row.some(Boolean))records.push(row);row=[];}continue;
  }
  if(closed && ch.trim())throw new Error('Unexpected text after a quoted CSV cell.');
  if(!closed)cell+=ch;
 }
 if(quoted)throw new Error('Unclosed quoted CSV cell.');
 row.push(cell.trim());if(row.some(Boolean))records.push(row);
 const originalHeaders=records.shift() || [];
 const headers=originalHeaders.map(h=>Object.prototype.hasOwnProperty.call(mapping,h)?mapping[h]:suggestIntakeField(h)||h);
 const required=['firstName','className','parentName','mobile'];
 const allowed=intakeFields;
 if(new Set(originalHeaders).size!==originalHeaders.length)throw new Error('Column headers must be unique.');
 const active=headers.filter(h=>h!=='__ignore__');
 const unknown=headers.filter(h=>h!=='__ignore__'&&!allowed.includes(h)&&!/^extra\.[a-z][a-zA-Z0-9_]{0,40}$/.test(h));
 if(unknown.length||required.some(h=>!headers.includes(h)&&!(h==='parentName'&&(headers.includes('fatherName')||headers.includes('motherName')))&&!(h==='mobile'&&(headers.includes('fatherMobile')||headers.includes('motherMobile'))))||new Set(active).size!==active.length){
  const message=unknown.length?'Unmapped columns: '+unknown.join(', '):new Set(active).size!==active.length?'Multiple columns map to the same field. Choose one and explicitly ignore the others.':'Missing required mappings: '+required.filter(h=>!headers.includes(h)).join(', ');
  const error=Object.assign(new Error(message+' Review the column mapping below.'),{columns:originalHeaders});throw error;
 }
 if(!records.length || records.length>500)throw new Error('Upload between 1 and 500 students at a time.');
 return records.map((values,index)=>{
  if(values.length!==headers.length)throw new Error('Row '+(index+2)+' has a different number of columns.');
  const data:any={extraFields:{}};
  headers.forEach((key,i)=>{if(key==='__ignore__')return;if(key.startsWith('extra.'))data.extraFields[key.slice(6)]=values[i];else if(values[i])data[key]=values[i];});
  data.parentName ||= data.fatherName || data.motherName;data.mobile ||= data.fatherMobile || data.motherMobile;if(data.gender)data.gender=data.gender.toUpperCase();
  if(data.dateOfBirth){try{data.dateOfBirth=normalizeImportDate(data.dateOfBirth);}catch(e:any){if(!allowInvalidRows)throw new Error('Row '+(index+2)+' DOB: '+e.message);}}
  if(!allowInvalidRows && required.some(key=>!data[key]))throw new Error('Row '+(index+2)+' is missing a required field.');
  return data;
 });
}
