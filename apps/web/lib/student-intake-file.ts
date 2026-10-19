import { compatibleWorkbook } from './compatible-workbook';
import { parseStudentIntakeCsv } from './student-intake-csv';
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const headers=['Admission Number','Student Name','DOB','Gender','Class','Father Name','Father Mobile','Mother Name','Mother Mobile','Parent Email','Address'];
export async function intakeWorkbookTemplate(){
 const module=await import('exceljs');const Excel=module.default || module;const book=new Excel.Workbook();const sheet=book.addWorksheet('Students');sheet.addRow(headers);sheet.getRow(1).font={bold:true};sheet.columns.forEach(c=>{c.width=22;c.numFmt='@';});sheet.getCell('A1').note='Optional. Leave blank for DAVI to generate from the school short name at enrollment.';sheet.getCell('C1').note='Common date formats are accepted.';return book.xlsx.writeBuffer();
}
export async function parseStudentIntakeFile(file:Pick<File,'name'|'size'|'type'|'arrayBuffer'|'text'>,mapping:Record<string,string>={}){
 if(file.size>1000000)throw new Error('Upload a CSV or XLSX smaller than 1 MB.');
 if(/\.csv$/i.test(file.name))return parseStudentIntakeCsv(await file.text(),mapping);
 if(!/\.xlsx$/i.test(file.name)|| (file.type && ![mime,'application/octet-stream','application/zip','application/vnd.ms-excel'].includes(file.type)))throw new Error('Choose a CSV or XLSX workbook.');
 const buffer=await file.arrayBuffer();const view=new DataView(buffer);
 if(buffer.byteLength<22||view.getUint32(0,true)!==0x04034b50)throw new Error('Invalid XLSX file signature.');
 // Bound decompression before ExcelJS loads the workbook.
 let end=-1;for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('Invalid XLSX ZIP directory.');
 const count=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true),expanded=0;
 if(count>2000||count===65535)throw new Error('Workbook contains too many entries.');
 for(let i=0;i<count;i++){
  if(offset+46>buffer.byteLength||view.getUint32(offset,true)!==0x02014b50)throw new Error('Invalid XLSX ZIP entry.');
  if(view.getUint16(offset+8,true)&1)throw new Error('Encrypted workbooks are unsupported.');
  expanded+=view.getUint32(offset+24,true);if(expanded>20000000)throw new Error('Workbook expands beyond the 20 MB limit.');
  offset+=46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
 }
 const module=await import('exceljs');const Excel=module.default || module;const book=new Excel.Workbook();try{await book.xlsx.load(await compatibleWorkbook(buffer));}catch(e:any){throw new Error('Unable to read this Excel workbook. '+(e.message?.includes('sheets')?'Open it in Excel and save a new XLSX copy.':e.message));}
 if(!book.worksheets.length||book.worksheets.length>20)throw new Error('Use between 1 and 20 worksheets.');
 const rows:any[]=[];
 for(const sheet of book.worksheets){
  if(sheet.rowCount>501||sheet.columnCount>100)throw new Error('Each sheet supports up to 500 students and 100 columns.');
  const lines:string[]=[];let width=0;sheet.eachRow(row=>{if(!row.hasValues)return;if(!width){width=row.cellCount;while(width>0 && !String(row.getCell(width).text).trim())width--;if(!width)return;}for(let col=width+1;col<=row.cellCount;col++)if(row.getCell(col).value!=null && String(row.getCell(col).text).trim())throw new Error('A row has data beyond the header columns. Add a heading or remove the extra values.');const cells:string[]=[];for(let col=1;col<=width;col++){
   const value=row.getCell(col).value;
   if(value&&typeof value==='object'&&('formula' in value||'sharedFormula' in value))throw new Error('Replace formulas with plain values before importing.');
   let text=value instanceof Date?value.toISOString().slice(0,10):value==null?'':typeof value==='object'&&'richText' in value?value.richText.map(t=>t.text).join(''):String(value);
   cells.push('"'+text.replace(/"/g,'""')+'"');
  }if(cells.some(c=>c!=='""'))lines.push(cells.join(','));});
  if(lines.length)rows.push(...parseStudentIntakeCsv(lines.join('\n'),mapping));
 }
 if(!rows.length||rows.length>500)throw new Error('Upload between 1 and 500 students at a time across all sheets.');return rows;
}
