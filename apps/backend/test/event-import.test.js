const test=require('node:test');
const assert=require('node:assert/strict');
const {MigrationExtractor,positionedRecords}=require('../dist/student-migration/migration-extractor');
const {eventMapping,eventImportSchema}=require('../dist/events/event-import');
const {EventsController}=require('../dist/events/events.controller');
const {ServiceUnavailableException}=require('@nestjs/common');
test('holiday uploads automatically select extraction without a user OCR setting',async()=>{
 const seen=[];
 const controller=new EventsController({}, {extract:async(buffer,file,options)=>{seen.push({file,options});return {rows:[{raw:{Name:'Holiday','Start date':'2027-01-01'}}]};}});
 for(const [name,mimetype,buffer]of [
  ['holidays.csv','text/csv',Buffer.from('Name,Start date\nHoliday,2027-01-01')],
  ['scan.pdf','application/pdf',Buffer.from('%PDF-1.4')],
  ['photo.png','image/png',Buffer.from([137,80,78,71,13,10,26,10])],
  ['photo.jpg','image/jpeg',Buffer.from([255,216,255])],
  ['photo.jpeg','image/jpeg',Buffer.from([255,216,255])],
 ]){
  const result=await controller.preview({user:{schoolId:'school'}},{originalname:name,mimetype,buffer});
  assert.equal(result.rows.length,1);assert.equal(seen.at(-1).file.mimeType,mimetype);assert.equal(seen.at(-1).options.localOcr,undefined);
 }
});
test('unavailable OCR gives holiday users an actionable message',async()=>{
 const controller=new EventsController({}, {extract:async()=>{throw new ServiceUnavailableException('Missing language data');}});
 await assert.rejects(()=>controller.preview({user:{schoolId:'school'}},{originalname:'photo.png',mimetype:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])}),/Text recognition is currently unavailable.*school administrator/);
});
test('calendar CSV recognizes event headings, quoted names and all event types',async()=>{
 const extracted=await new MigrationExtractor().extract(Buffer.from('Name,Start date,Type\n"Festival, school",2026-12-25,HOLIDAY\nSports,2026-12-26,IMPORTANT_EVENT\nClosure,2026-12-27,NON_WORKING_DAY\nExam,2026-12-28,EXAM'),{name:'events.csv',mimeType:'text/csv'},{headingMapping:eventMapping},{maxRows:500,maxPages:20},async()=>{});
 assert.equal(extracted.rows.length,4);assert.equal(extracted.rows[0].raw.Name,'Festival, school');assert.equal(extracted.rows[3].raw.Type,'EXAM');
});
test('positioned PDF and OCR tables recognize calendar headings',()=>{
 const rows=positionedRecords([{x:0,y:100,width:30,text:'Name'},{x:200,y:100,width:50,text:'Start date'},{x:0,y:80,width:60,text:'New year'},{x:200,y:80,width:60,text:'2027-01-01'}],'events.pdf',1,null,3,eventMapping);
 assert.equal(rows.length,1);assert.equal(rows[0].raw.Name,'New year');assert.equal(rows[0].raw['Start date'],'2027-01-01');
});
test('calendar Excel reads multiple sheets and real date cells',async()=>{
 const Excel=require('exceljs'),book=new Excel.Workbook();for(const type of ['HOLIDAY','SCHOOL_CLOSURE']){const sheet=book.addWorksheet(type);sheet.addRow(['Name','Start date','Type']);sheet.addRow(['Closure',new Date('2026-12-25T00:00:00Z'),type]);}
 const result=await new MigrationExtractor().extract(Buffer.from(await book.xlsx.writeBuffer()),{name:'events.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},{headingMapping:eventMapping},{maxRows:500,maxPages:20},async()=>{});
 assert.equal(result.rows.length,2);assert.equal(result.rows[0].raw['Start date'],'2026-12-25');assert.equal(result.rows[1].raw.Type,'SCHOOL_CLOSURE');
});
test('bulk import validates the entire batch, dates, scope and limits',()=>{
 const row={title:'Holiday',eventType:'CUSTOM_EVENT',startsAt:'2026-12-25T00:00:00+05:30',endsAt:'2026-12-25T23:59:59+05:30'};
 assert.equal(eventImportSchema.safeParse([row]).success,true);
 for(const invalid of [[row,{...row,title:''}],[{...row,endsAt:'2026-12-24T00:00:00Z'}],[{...row,schoolId:'other'}],Array(501).fill(row),[]])assert.equal(eventImportSchema.safeParse(invalid).success,false);
});
