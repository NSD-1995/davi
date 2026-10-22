const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Excel=require('exceljs');
function load(name){const api={};new Function('exports','require',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/'+name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(api,n=>n.startsWith('./')?load(n.slice(2)):require(n));return api;}
const {parseStudentIntakeFile:parse,intakeWorkbookTemplate:template}=load('student-intake-file');
function file(buffer,name='students.xlsx'){return {name,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',size:buffer.length,arrayBuffer:async()=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)};}
test('XLSX intake supports multiple sheets and preserves text mobiles and dates',async()=>{const b=new Excel.Workbook();for(const grade of ['Class 3','Class 4']){const s=b.addWorksheet(grade);s.addRow(['firstName','className','parentName','mobile','dateOfBirth']);s.addRow(['Child',grade,'Parent','0987654321',new Date('2018-01-01')]);}const rows=await parse(file(await b.xlsx.writeBuffer()));assert.equal(rows.length,2);assert.equal(rows[1].className,'Class 4');assert.equal(rows[0].mobile,'0987654321');assert.equal(rows[0].dateOfBirth,'2018-01-01');});
test('XLSX intake rejects formulas and wrong signatures',async()=>{await assert.rejects(parse(file(Buffer.from('not a workbook'))),/signature/);const b=new Excel.Workbook(),s=b.addWorksheet('Students');s.addRow(['firstName','className','parentName','mobile']);s.addRow([{formula:'1+1',result:2},'Class 3','Parent','9876543210']);await assert.rejects(parse(file(await b.xlsx.writeBuffer())),/formulas/);});
test('Excel intake template has only the requested student intake fields',async()=>{const b=new Excel.Workbook();await b.xlsx.load(await template());assert.deepEqual(b.worksheets[0].getRow(1).values.slice(1),['Admission Number','Student Name','DOB','Gender','Class','Father Name','Father Mobile','Mother Name','Mother Mobile','Parent Email','Address']);});

test('school workbook headings and trailing formatted columns are accepted',async()=>{const b=new Excel.Workbook(),s=b.addWorksheet('Students');s.addRow(['Student Name','Class','Parent Name','Mobile Number','DOB']);s.addRow(['Child','Class 3','Parent','0987654321','2018-01-01']);s.getCell('K1').numFmt='@';s.getCell('K2').numFmt='@';const rows=await parse(file(await b.xlsx.writeBuffer()));assert.equal(rows[0].firstName,'Child');assert.equal(rows[0].mobile,'0987654321');});

test('prefixed SpreadsheetML workbook loads and normalizes DOB formats',async()=>{const b=new Excel.Workbook(),s=b.addWorksheet('Students');s.addRow(['Student Name','Class','Parent Name','Mobile','DOB']);for(const dob of ['31/12/2018','Dec 31, 2018','2018.12.31',43465])s.addRow(['Child','Class 3','Parent','9876543210',dob]);const Zip=require('jszip'),zip=await Zip.loadAsync(await b.xlsx.writeBuffer());for(const entry of Object.values(zip.files))if(!entry.dir&&/^xl\/.*\.xml$/.test(entry.name)){let xml=await entry.async('string');if(xml.includes('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')){xml=xml.replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"','xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace(/<(\/?)([a-zA-Z][\w]*)(?=[\s/>])/g,'<$1x:$2');zip.file(entry.name,xml);}}const rows=await parse(file(await zip.generateAsync({type:'nodebuffer'})));assert.equal(rows.length,4);for(const row of rows.slice(0,3))assert.equal(row.dateOfBirth,'2018-12-31');assert.match(rows[3].dateOfBirth,/^\d{4}-\d{2}-\d{2}$/);});
test('invalid DOB requires correction instead of rolling into another month',()=>{const normalize=load('import-date').normalizeImportDate;assert.equal(normalize('01/02/2018'),'2018-02-01');assert.equal(normalize('12/31/2018'),'2018-12-31');assert.throws(()=>normalize('31/02/2018'),/Invalid/);assert.throws(()=>normalize('01/02/18'),/four-digit/);});

test('nonstandard Excel comment paths do not prevent reading student cells',async()=>{
 const b=new Excel.Workbook(),s=b.addWorksheet('Students');s.addRow(['Student Name','Class','Parent Name','Mobile','DOB']);s.addRow(['Child','Class 3','Parent','9876543210','31/12/2018']);s.getCell('A1').note='Student heading';
 const Zip=require('jszip'),zip=await Zip.loadAsync(await b.xlsx.writeBuffer());const comments=zip.file('xl/comments1.xml');assert.ok(comments);zip.file('xl/comments/comment1.xml',await comments.async('string'));zip.remove('xl/comments1.xml');const rel=zip.file('xl/worksheets/_rels/sheet1.xml.rels');zip.file(rel.name,(await rel.async('string')).replace('../comments1.xml','../comments/comment1.xml'));const buffer=await zip.generateAsync({type:'nodebuffer'});
 const broken=new Excel.Workbook();await assert.rejects(broken.xlsx.load(buffer),/comments/);
 const rows=await parse(file(buffer));assert.equal(rows.length,1);assert.equal(rows[0].firstName,'Child');assert.equal(rows[0].dateOfBirth,'2018-12-31');
});

test('custom workbook columns can be mapped or explicitly ignored before preview',async()=>{const b=new Excel.Workbook(),s=b.addWorksheet('Students');s.addRow(['Pupil Full Name','Level Applied','Guardian','Contact','DOB','Serial No','Section']);s.addRow(['Child','Class 3','Parent','9876543210','31/12/2018','1','A']);const upload=file(await b.xlsx.writeBuffer());await assert.rejects(parse(upload),e=>Array.isArray(e.columns)&&e.message.includes('Serial No'));const rows=await parse(upload,{'Pupil Full Name':'firstName','Level Applied':'className',Guardian:'parentName',Contact:'mobile','Serial No':'__ignore__',Section:'__ignore__'});assert.equal(rows[0].firstName,'Child');assert.equal(rows[0].dateOfBirth,'2018-12-31');assert.equal(rows[0].Section,undefined);});
test('mapping rejects duplicate targets and missing required fields',()=>{const parseCsv=load('student-intake-csv').parseStudentIntakeCsv;const csv='firstName,className,parentName,mobile,Other\nChild,Class 3,Parent,9876543210,Another';assert.throws(()=>parseCsv(csv,{Other:'firstName'}),/Multiple columns/);assert.throws(()=>parseCsv(csv,{firstName:'__ignore__',Other:'__ignore__'}),/Missing required/);});

test('requested template preserves both parents, address and optional admission number',async()=>{const b=new Excel.Workbook();await b.xlsx.load(await template());b.worksheets[0].addRow(['','Child','31/12/2018','female','Class 3','Father','9876543210','Mother','9876543211','parent@example.com','Home address']);const rows=await parse(file(await b.xlsx.writeBuffer()));assert.equal(rows[0].admissionNumber,undefined);assert.equal(rows[0].fatherName,'Father');assert.equal(rows[0].motherMobile,'9876543211');assert.equal(rows[0].parentEmail,'parent@example.com');assert.equal(rows[0].address,'Home address');assert.equal(rows[0].gender,'FEMALE');});

test('XLSX tables with producer-specific paths retain student cells and date styles',async()=>{
 const b=new Excel.Workbook(),s=b.addWorksheet('Students');
 s.addTable({name:'StudentsTable',ref:'A1',headerRow:true,columns:['Student Name','Class','Parent Name','Mobile','DOB'].map(name=>({name})),rows:[['Child','Class 3','Parent','9876543210',new Date('2018-12-31')]]});
 s.getCell('E2').numFmt='dd/mm/yyyy';
 const Zip=require('jszip'),zip=await Zip.loadAsync(await b.xlsx.writeBuffer());
 zip.file('xl/tables/student-list.xml',await zip.file('xl/tables/table1.xml').async('string'));zip.remove('xl/tables/table1.xml');
 const rel=zip.file('xl/worksheets/_rels/sheet1.xml.rels');zip.file(rel.name,(await rel.async('string')).replace('../tables/table1.xml','../tables/student-list.xml'));
 const buffer=await zip.generateAsync({type:'nodebuffer'});
 await assert.rejects(new Excel.Workbook().xlsx.load(buffer),/reading 'name'/);
 const rows=await parse(file(buffer));assert.equal(rows.length,1);assert.equal(rows[0].firstName,'Child');assert.equal(rows[0].dateOfBirth,'2018-12-31');
 const backendPath=path.join(__dirname,'../../backend/src/student-migration/compatible-workbook.ts');
 assert.equal(fs.readFileSync(backendPath,'utf8').trim(),fs.readFileSync(path.join(__dirname,'../lib/compatible-workbook.ts'),'utf8').trim());
});

test('review mode keeps invalid DOB and missing row fields so other students can import',()=>{
 const parseCsv=load('student-intake-csv').parseStudentIntakeCsv;
 const csv='Student Name,Class,Parent Name,Mobile,DOB\nReady,Class 3,Parent,9876543210,31/12/2018\nNeeds correction,,Parent,9876543211,31/02/2018';
 const rows=parseCsv(csv,{},true);assert.equal(rows.length,2);assert.equal(rows[0].dateOfBirth,'2018-12-31');assert.equal(rows[1].dateOfBirth,'31/02/2018');assert.equal(rows[1].className,undefined);
});
