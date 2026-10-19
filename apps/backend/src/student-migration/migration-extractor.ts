import { compatibleWorkbook } from './compatible-workbook';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { resolve } from 'path';
import { access } from 'fs/promises';
import { csvRecords, inspectWorkbookZip, tableRecords, suggestMapping, inspectImageDimensions } from './migration-rules';
const dynamicImport=new Function('specifier','return import(specifier)') as (s:string)=>Promise<any>;
export function positionedRecords(items:any[],source:string,page:number,confidence:number|null,tolerance=3){
 const lines:any[][]=[];for(const item of [...items].sort((a,b)=>b.y-a.y || a.x-b.x)){const line=lines.find(l=>Math.abs(l[0].y-item.y)<tolerance);if(line)line.push(item);else lines.push([item]);}
 let headers:any[]=[],table=0;const result:any[]=[];
 for(const [index,line]of lines.entries()){
  const cells:any[]=[];for(const item of line.sort((a,b)=>a.x-b.x)){const previous=cells[cells.length-1];if(previous&&item.x-(previous.x+previous.width)<=18){previous.text+=' '+item.text;previous.width=item.x+item.width-previous.x;}else cells.push({...item});}
  if(Object.keys(suggestMapping(cells.map(c=>c.text))).length>=2){headers=cells;table++;continue;}
  if(!headers.length){headers=cells.map((c,i)=>({...c,text:'Column '+(i+1)}));table++;}
  const raw:any={},evidence:any={};for(const h of headers){if(h.text in raw)throw new BadRequestException('Duplicate PDF/image headings require review.');raw[h.text]='';}
  for(const cell of cells){let target=headers[0];for(const h of headers)if(h.x<=cell.x+20)target=h;raw[target.text]+=(raw[target.text]?' ':'')+cell.text;}
  for(const h of headers)evidence[h.text]={sourceFile:source,page,table,row:index+1,original:raw[h.text],extracted:raw[h.text],confidence,columnX:h.x};
  result.push({raw,evidence,page,sourceRef:source+':'+page+':'+table+':'+(index+1)});
 }return result;
}
@Injectable()
export class MigrationExtractor {
 async workbookTemplate(){const Excel=require('exceljs');const workbook=new Excel.Workbook();const sheet=workbook.addWorksheet('Students');sheet.addRow(['Admission Number','Student Name','DOB','Gender','Class','Father Name','Father Mobile','Mother Name','Mother Mobile','Parent Email','Address']);sheet.getRow(1).font={bold:true};sheet.columns.forEach((c:any)=>{c.width=22;c.numFmt='@';});sheet.getCell('A1').note='Optional. Leave blank for a school-short-name admission number generated at enrollment.';sheet.getCell('C1').note='Use YYYY-MM-DD dates.';sheet.getCell('E1').note='Use an active class in the selected school and academic year.';return Buffer.from(await workbook.xlsx.writeBuffer());}
 async extract(buffer:Buffer,file:any,options:any,policy:any,progress:(pages:number)=>Promise<void>){
  if(file.mimeType==='text/csv')return {pages:1,rows:tableRecords(csvRecords(buffer.toString('utf8').replace(/^\uFEFF/,''),policy.maxRows+100),file.name,1)};
  if(file.mimeType.includes('spreadsheetml')){
   inspectWorkbookZip(buffer);const Excel=require('exceljs'),book=new Excel.Workbook();await book.xlsx.load(await compatibleWorkbook(buffer));if(book.worksheets.length>policy.maxPages)throw new BadRequestException('Too many workbook sheets.');
   const rows:any[]=[];for(const [index,sheet]of book.worksheets.entries()){
    if(sheet.rowCount>policy.maxRows+100)throw new BadRequestException('Worksheet row limit exceeded. Split the workbook.');
    const records:string[][]=[],references:number[]=[],originals:any[]=[];sheet.eachRow((row:any,rowNumber:number)=>{const cells:string[]=[],original:any={};row.eachCell({includeEmpty:true},(cell:any,column:number)=>{const formula=cell.value?.formula || cell.value?.sharedFormula;cells[column-1]=cell.value instanceof Date?cell.value.toISOString().slice(0,10):formula?'':cell.text;if(formula)original[column-1]='='+formula;});references.push(rowNumber);originals.push(original);records.push(Array.from({length:cells.length},(_,i)=>cells[i] || ''));});
    const extractedRows=tableRecords(records,file.name+' / '+sheet.name,index+1);for(const extracted of extractedRows){const sourceIndex=(Object.values(extracted.evidence)[0] as any).row-1;for(const [heading,evidence]of Object.entries(extracted.evidence) as any[]){const column=Object.keys(extracted.raw).indexOf(heading);evidence.row=references[sourceIndex];if(originals[sourceIndex]?.[column]){evidence.original=originals[sourceIndex][column];evidence.confidence=null;evidence.method='FORMULA_NOT_EVALUATED';}}extracted.sourceRef=extracted.sourceRef.replace(/:[0-9]+$/,':'+references[sourceIndex]);}rows.push(...extractedRows);if(rows.length>policy.maxRows)throw new BadRequestException('Row limit exceeded.');await progress(index+1);
   }return {pages:book.worksheets.length,rows};
  }
  if(file.mimeType==='application/pdf'){
   const pdfjs=await dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');const doc=await pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true,disableFontFace:true,maxImageSize:20000000,stopAtErrors:true,verbosity:0}).promise;
   try{if(doc.numPages>policy.maxPages)throw new BadRequestException('PDF page limit exceeded. Split this document.');const rows:any[]=[];
    for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
     const page=await doc.getPage(pageNumber),content=await page.getTextContent();if(content.items.length>20000)throw new BadRequestException('PDF page has too many text elements. Split or simplify this source.');const items=content.items.filter((i:any)=>i.str?.trim()).map((i:any)=>({x:i.transform[4],y:i.transform[5],width:i.width,text:i.str}));
     const operators=await page.getOperatorList();const hasImage=operators.fnArray.some((op:number)=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageXObjectRepeat].includes(op));const tableHeadings=Object.keys(suggestMapping(items.map((i:any)=>i.text))).length;
     if(items.reduce((n:number,i:any)=>n+i.text.length,0)>30&&(!hasImage||tableHeadings>=2||items.length>=20))rows.push(...positionedRecords(items,file.name,pageNumber,null));
     else{
      if(!options.localOcr)throw new BadRequestException('Scanned page '+pageNumber+' needs opt-in local OCR. Enable OCR and retry.');
      const {createCanvas}=require('@napi-rs/canvas');const viewport=page.getViewport({scale:2});if(viewport.width*viewport.height>20000000)throw new BadRequestException('PDF page exceeds the raster pixel limit.');
      const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;rows.push(...await this.ocr(canvas.toBuffer('image/png'),file.name,pageNumber));
     }
     page.cleanup();if(rows.length>policy.maxRows)throw new BadRequestException('Extracted row limit exceeded.');await progress(pageNumber);
    }return {pages:doc.numPages,rows};
   }finally{await doc.destroy();}
  }
  if(!options.localOcr)throw new BadRequestException('Images require opt-in local OCR. Enable OCR and retry.');
  return {pages:1,rows:await this.ocr(buffer,file.name,1)};
 }
 async ocr(buffer:Buffer,name:string,page:number){
  const langPath=process.env.MIGRATION_OCR_LANG_PATH;
  if(!langPath)throw new ServiceUnavailableException('Local OCR language data is not configured. Set MIGRATION_OCR_LANG_PATH to a private local directory containing eng.traineddata.');
  await access(resolve(langPath,'eng.traineddata')).catch(()=>{throw new ServiceUnavailableException('Local OCR eng.traineddata is missing.');});
  inspectImageDimensions(buffer);
  const {loadImage,createCanvas}=require('@napi-rs/canvas');const image=await loadImage(buffer);if(image.width*image.height>20000000)throw new BadRequestException('Image exceeds the 20-megapixel limit.');const canvas=createCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);
  const {createWorker}=require('tesseract.js');const worker=await createWorker('eng',1,{langPath,gzip:false,cacheMethod:'none',logger:()=>undefined});let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   let recognized:any=null,bestScore=-1;
   for(const rotation of [0,90,180,270]){
    const turned=createCanvas(rotation%180?image.height:image.width,rotation%180?image.width:image.height),context=turned.getContext('2d');context.translate(turned.width/2,turned.height/2);context.rotate(rotation*Math.PI/180);context.drawImage(image,-image.width/2,-image.height/2);
    const attempt:any=await Promise.race([worker.recognize(turned.toBuffer('image/png'),{rotateAuto:true},{text:true,tsv:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new BadRequestException('OCR timed out. Split or sharpen the source image.')),180000);})]);if(timer)clearTimeout(timer);
    const headings=new Set((String(attempt.data.text).match(/admission|student|class|parent|mobile/gi)||[]).map((v:string)=>v.toLowerCase())).size;const score=Number(attempt.data.confidence || 0)+headings*8;
    if(score>bestScore){recognized={...attempt,rotation};bestScore=score;}
    if(headings>=3&&Number(attempt.data.confidence)>85)break;
   }
   const lines=new Map<string,any[]>();for(const tsv of String(recognized.data.tsv || '').split('\n').slice(1)){const c=tsv.split('\t');if(c[0]!=='5'||!c[11]?.trim())continue;const key=c.slice(1,5).join(':');const words=lines.get(key)||[];words.push({x:Number(c[6]),y:-(Number(c[7])+Number(c[9])/2),width:Number(c[8]),text:c.slice(11).join('\t')});lines.set(key,words);}
   const rows=positionedRecords([...lines.values()].flat(),name,page,Math.max(0,Number(recognized.data.confidence || 0))/100,10);
   for(const row of rows)for(const value of Object.values(row.evidence) as any[]){value.method='LOCAL_OCR';value.rotation=recognized.rotation;}
   if(!rows.length)throw new BadRequestException('OCR found no readable rows. Upload a sharper, upright image or use the Excel template.');return rows;
  }finally{if(timer)clearTimeout(timer);await worker.terminate();}
 }
}
