import { compatibleWorkbook } from './compatible-workbook';
export function parseMarksCsv(source:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<source.length;i++){const c=source[i];if(quoted){if(c==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw new Error('Invalid CSV quotation.');quoted=true;}else if(c===','||c==='\n'||c==='\r'){row.push(cell.trim().replace(/^\uFEFF/,''));cell='';closed=false;if(c!==','){if(c==='\r'&&source[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);row=[];}}else if(closed&&c.trim())throw new Error('Invalid text after quoted field.');else if(!closed)cell+=c;
 }if(quoted)throw new Error('Unclosed CSV quotation.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows;
}
export async function readMarksFile(file:File){
 if(file.size>1000000)throw new Error('Use a CSV or XLSX under 1 MB.');
 if(/\.csv$/i.test(file.name))return parseMarksCsv(await file.text());
 if(!/\.xlsx$/i.test(file.name))throw new Error('Choose CSV or XLSX.');
 const buffer=await file.arrayBuffer(),v=new DataView(buffer);if(buffer.byteLength<22||v.getUint32(0,true)!==0x04034b50)throw new Error('Invalid XLSX signature.');
 let end=-1;for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}if(end<0)throw new Error('Invalid workbook ZIP.');
 const count=v.getUint16(end+10,true);let offset=v.getUint32(end+16,true),size=0;if(count>2000)throw new Error('Too many workbook entries.');
 for(let i=0;i<count;i++){if(offset+46>buffer.byteLength||v.getUint32(offset,true)!==0x02014b50)throw new Error('Invalid ZIP entry.');if(v.getUint16(offset+8,true)&1)throw new Error('Encrypted workbooks are unsupported.');size+=v.getUint32(offset+24,true);if(size>20000000)throw new Error('Expanded workbook exceeds 20 MB.');offset+=46+v.getUint16(offset+28,true)+v.getUint16(offset+30,true)+v.getUint16(offset+32,true);}
 const mod=await import('exceljs'),Excel=mod.default||mod,book=new Excel.Workbook();await book.xlsx.load(await compatibleWorkbook(buffer));
 if(book.worksheets.length!==1)throw new Error('Use one marks worksheet per upload.');const sheet=book.worksheets[0];if(sheet.rowCount>501||sheet.columnCount>30)throw new Error('Use at most 500 students and 30 columns.');
 const rows:string[][]=[];let width=0;sheet.eachRow(row=>{if(!row.hasValues)return;width ||= row.cellCount;const cells:string[]=[];for(let i=1;i<=width;i++){const c=row.getCell(i);if(c.value&&typeof c.value==='object'&&('formula'in c.value||'sharedFormula'in c.value))throw new Error('Replace formulas with plain values.');cells.push(c.text.trim());}rows.push(cells);});return rows;
}
export function mapMarksImport(rows:string[][],roster:any[],config:any){
 const [headers,...data]=rows,errors:any[]=[],records:any[]=[];const expected=['Admission Number','State',...(config.type==='GRADE'?['Grade']:config.components.map((c:any)=>c.key)),'Remarks'];
 if(!headers||headers.length!==expected.length||headers.some((h,i)=>h!==expected[i]))throw new Error('Use these exact headings: '+expected.join(', '));
 if(!data.length||data.length>500)throw new Error('Upload between 1 and 500 rows.');const seen=new Set<string>();
 data.forEach((values,index)=>{const row=index+2;try{if(values.length!==headers.length)throw new Error('Column count differs from headings.');const student=roster.find(e=>e.admissionNumber===values[0]);if(!student)throw new Error('Admission number is outside this assessment roster.');if(seen.has(student.enrollmentId))throw new Error('Duplicate student in upload.');seen.add(student.enrollmentId);const state=values[1].toUpperCase()||'PRESENT';if(!['PRESENT','ABSENT','EXEMPT'].includes(state))throw new Error('State must be PRESENT, ABSENT or EXEMPT.');const scores:Record<string,number>={};let grade:string|undefined;if(config.type==='GRADE')grade=values[2]||undefined;else config.components.forEach((c:any,i:number)=>{if(values[i+2]!==undefined&&values[i+2]!==''){const n=Number(values[i+2]);if(!Number.isFinite(n))throw new Error(c.label+' must be numeric.');scores[c.key]=n;}});records.push({enrollmentId:student.enrollmentId,state,scores,...(grade?{grade}:{}),remarks:values[values.length-1]||''});}catch(e:any){errors.push({row,message:e.message});}});return {records,errors};
}
