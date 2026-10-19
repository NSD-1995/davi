import { normalizeImportDate } from './import-date';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { createHash } from 'crypto';
export const fields=['admissionNumber','firstName','lastName','fullName','dateOfBirth','gender','className','sectionName','parentName','parentMobile','parentEmail','address','admissionDate','parentId','fatherName','fatherMobile','motherName','motherMobile'] as const;
export const field=z.enum(fields);
export const policySchema=z.object({maxFileMB:z.number().int().min(1).max(20).default(10),maxFiles:z.number().int().min(1).max(10).default(5),maxPages:z.number().int().min(1).max(200).default(50),maxRows:z.number().int().min(1).max(10000).default(5000),retentionDays:z.number().int().min(1).max(90).default(7),jobsPerHour:z.number().int().min(1).max(50).default(10),secondaryIdentifiers:z.array(z.enum(['NAME_DOB','PARENT_MOBILE'])).default(['NAME_DOB','PARENT_MOBILE'])}).strict();
export const defaultPolicy=policySchema.parse({});
export const digest=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const normalize=(value:any)=>String(value ?? '').trim().replace(/\s+/g,' ');
const aliases:Record<string,string[]>={admissionNumber:['admissionno','admissionnumber','admno','admissionid','studentid','regno','registrationnumber'],firstName:['firstname','studentfirstname'],lastName:['lastname','surname'],fullName:['name','studentname','fullname','nameofstudent','pupil','pupilname','childname','learnername'],dateOfBirth:['dob','dateofbirth','birthdate'],gender:['gender','sex'],className:['class','classname','grade','standard','std'],sectionName:['section','sectionname','division'],fatherName:['fathername','fathersname'],fatherMobile:['fathermobile','fathermobilenumber'],motherName:['mothername','mothersname'],motherMobile:['mothermobile','mothermobilenumber'],parentName:['parent','guardian','parentname','guardianname'],parentMobile:['mobile','phone','parentmobile','contact','contactnumber','mobileno','phonenumber'],parentEmail:['email','parentemail'],address:['address','residentialaddress'],admissionDate:['admissiondate','dateofadmission','joiningdate'],parentId:['verifiedparentid','parentid']};
export function suggestMapping(headers:string[]){const result:Record<string,string>={};for(const header of headers){const key=header.toLowerCase().replace(/[^a-z0-9]/g,'');const match=fields.find(f=>f.toLowerCase()===key || aliases[f]?.includes(key));if(match)result[header]=match;}for(const target of fields){const sources=Object.keys(result).filter(key=>result[key]===target);if(sources.length>1)for(const source of sources)delete result[source];}return result;}
export function mappedValues(raw:any,mapping:Record<string,string>){const values:any={};for(const [key,target] of Object.entries(mapping))if(fields.includes(target as any)&&Object.prototype.hasOwnProperty.call(raw,key)){const value=normalize(raw[key]);if(values[target]&&value&&values[target]!==value)throw new BadRequestException('Two source columns map conflicting values to '+target+'. Correct the mapping.');if(value||values[target]===undefined)values[target]=value;}values.parentName ||= values.fatherName || values.motherName;values.parentMobile ||= values.fatherMobile || values.motherMobile;for(const key of ['dateOfBirth','admissionDate'])if(values[key]){try{values[key]=normalizeImportDate(values[key]);}catch{/* Preserve unrecognized input for row validation. */}}if(!values.firstName && values.fullName)values.firstName=values.fullName;return values;}
export function validationIssues(values:any){const errors:string[]=[];for(const role of ['father','mother']){if(Boolean(values[role+'Name'])!==Boolean(values[role+'Mobile']))errors.push(role+' name and mobile must both be supplied.');if(values[role+'Mobile']&&!/^[6-9]\d{9}$/.test(values[role+'Mobile'].replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'')))errors.push('Invalid '+role+' mobile.');}if(values.fatherMobile&&values.motherMobile&&values.fatherMobile===values.motherMobile)errors.push('Father and mother require distinct mobile numbers.');for(const key of ['firstName','className','parentName','parentMobile'])if(!values[key])errors.push('Missing '+key);if(values.parentMobile && !/^[6-9]\d{9}$/.test(values.parentMobile.replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'')))errors.push('Invalid parent mobile number.');for(const key of ['dateOfBirth','admissionDate'])if(values[key] && !z.string().date().safeParse(values[key]).success)errors.push(key+' must be YYYY-MM-DD.');if(values.gender && !['MALE','FEMALE','OTHER'].includes(values.gender.toUpperCase()))errors.push('Gender must be MALE, FEMALE or OTHER.');if(values.parentEmail && !z.string().email().safeParse(values.parentEmail).success)errors.push('Invalid parent email.');for(const [key,value]of Object.entries(values))if(String(value).length>2000)errors.push(key+' exceeds the field limit.');return errors;}
export function csvRecords(input:string,maxRows=20000):string[][]{
 let quotedHeader=false;const delimiters=[',',';','\t','|'],counts=[0,0,0,0];for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quotedHeader&&input[i+1]==='"')i++;else quotedHeader=!quotedHeader;continue;}if(!quotedHeader){if(c==='\n'||c==='\r')break;const index=delimiters.indexOf(c);if(index>=0)counts[index]++;}}const delimiter=delimiters[counts.indexOf(Math.max(...counts))];
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<input.length;i++){const c=input[i];if(quoted){if(c==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}if(c==='"'){if(cell || closed)throw new BadRequestException('Malformed CSV quotation.');quoted=true;continue;}if(c===delimiter||c==='\n'||c==='\r'){row.push(cell.trim());cell='';closed=false;if(c!==delimiter){if(c==='\r'&&input[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);if(rows.length>maxRows)throw new BadRequestException('CSV source row limit exceeded. Split the file.');row=[];}continue;}if(closed&&c.trim())throw new BadRequestException('Unexpected content after CSV quotation.');if(!closed)cell+=c;}
 if(quoted)throw new BadRequestException('Unclosed CSV quotation.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);if(rows.length>maxRows)throw new BadRequestException('CSV source row limit exceeded. Split the file.');return rows;
}
export function tableRecords(records:string[][],source:string,page:number,confidence:number|null=1){
 let headers:string[]=[],table=0;const output:any[]=[];
 for(const [index,cells]of records.entries()){
  if(!cells.some(Boolean))continue;
  if(Object.keys(suggestMapping(cells)).length>=2){headers=cells.map((h,i)=>normalize(h)||'Column '+(i+1));table++;continue;}
  if(!headers.length){headers=cells.map((_,i)=>'Column '+(i+1));table++;}
  if(cells.every((c,i)=>normalize(c)===headers[i]))continue;
  const raw:any={},evidence:any={};cells.forEach((value,i)=>{const key=headers[i] || 'Column '+(i+1);if(key in raw)throw new BadRequestException('Duplicate source headings require correction: '+key);raw[key]=value;evidence[key]={sourceFile:source,page,table,row:index+1,original:value,extracted:value,confidence};});
  output.push({raw,evidence,page,sourceRef:source+':'+page+':'+table+':'+(index+1)});
 }
 return output;
}
export function csvCell(value:any){const text=String(value ?? '');return '"'+(/^(?:\s*[=+@\-]|[\t\r])/.test(text)?"'"+text:text).replace(/"/g,'""')+'"';}
export function fileType(name:string,mime:string,buffer:Buffer){
 const ext=name.toLowerCase().split('.').pop();let type='';
 if(buffer.subarray(0,5).toString()==='%PDF-')type='application/pdf';
 else if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))type='image/png';
 else if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)type='image/jpeg';
 else if(buffer.subarray(0,4).equals(Buffer.from([80,75,3,4])))type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 else if(ext==='csv' && !buffer.includes(0) && Buffer.from(buffer.toString('utf8'),'utf8').equals(buffer))type='text/csv';
 const extensions:Record<string,string[]>={'text/csv':['csv'],'application/pdf':['pdf'],'image/png':['png'],'image/jpeg':['jpg','jpeg'],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['xlsx']};
 if(!type || !extensions[type].includes(ext || '') || !(mime===type || (type==='text/csv' && ['application/vnd.ms-excel','text/plain'].includes(mime))))throw new BadRequestException('File extension, MIME type and signature must agree. Use CSV, XLSX, PDF, JPG or PNG.');
 if(type.includes('spreadsheetml'))inspectWorkbookZip(buffer);
 return type;
}
/** Inspect ZIP directory before ExcelJS inflates any XML. */
export function inspectWorkbookZip(buffer:Buffer){
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw new BadRequestException('Invalid XLSX ZIP directory.');
 const entries=buffer.readUInt16LE(end+10);if(entries>5000)throw new BadRequestException('Workbook has too many ZIP entries.');
 let offset=buffer.readUInt32LE(end+16),total=0;let workbook=false;
 for(let i=0;i<entries;i++){
  if(offset+46>buffer.length || buffer.readUInt32LE(offset)!==0x02014b50)throw new BadRequestException('Invalid XLSX ZIP entry.');
  const size=buffer.readUInt32LE(offset+24),nameLength=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32);total+=size;
  const name=buffer.subarray(offset+46,offset+46+nameLength).toString();if(name==='xl/workbook.xml')workbook=true;
  if(total>100*1024*1024 || size>25*1024*1024 || /vbaProject|\.exe$|\.dll$|\.bin$/i.test(name))throw new BadRequestException('Workbook is oversized or contains embedded executable content.');offset+=46+nameLength+extra+comment;
 }
 if(!workbook)throw new BadRequestException('ZIP file is not an XLSX workbook.');
}

export function inspectImageDimensions(buffer:Buffer){
 let width=0,height=0;
 if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){if(buffer.length<24)throw new BadRequestException('Truncated PNG header.');width=buffer.readUInt32BE(16);height=buffer.readUInt32BE(20);}
 else{let offset=2;while(offset+4<=buffer.length){if(buffer[offset]!==255){offset++;continue;}const marker=buffer[offset+1];offset+=2;if(marker===0xDA||marker===0xD9)break;if(marker>=0xD0&&marker<=0xD8||marker===1)continue;const length=buffer.readUInt16BE(offset);if(length<2||offset+length>buffer.length)throw new BadRequestException('Truncated JPEG marker.');if([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)){if(length<8)throw new BadRequestException('Invalid JPEG dimensions.');height=buffer.readUInt16BE(offset+3);width=buffer.readUInt16BE(offset+5);break;}offset+=length;}}
 if(!width||!height||width*height>20000000)throw new BadRequestException('Image is invalid or exceeds the 20-megapixel limit.');return {width,height};
}
