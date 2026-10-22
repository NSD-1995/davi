require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {StudentIntakeService}=require('../dist/student-admissions/student-intake.service');
const row={firstName:'Child',lastName:'',className:'Class 1',parentName:'Parent',mobile:'9876543210'};
function fixture(){
 const classes=['Class 1','Nursery'].map((name,i)=>({id:'class'+i,name,academicYearId:'year',academicGroup:i?'UNCONFIGURED':'PRIMARY',sections:[]}));
 const stored=[],queries=[];
 const tx={academicYear:{findFirst:async()=>({id:'year'})},schoolClass:{findMany:async()=>classes},schoolSetting:{findUnique:async()=>({sectionCapacityPolicy:{rules:[{academicYearId:'year',level:'ACADEMIC_LEVEL',target:'PRIMARY',maximum:25}]}})},studentEnrollment:{findFirst:async q=>{queries.push(q);return stored.some(r=>r.firstName===q.where.OR.at(-1).student.user.firstName.equals)?{id:'existing'}:null;},findMany:async()=>[]},admissionApplication:{findFirst:async()=>null,findMany:async()=>[]},auditLog:{findFirst:async()=>null,create:async()=>{}},section:{create:async()=>{},findFirst:async()=>({id:'section'})},$executeRawUnsafe:async()=>{}};
 const db={$transaction:async fn=>fn(tx)};
 const service=new StudentIntakeService(db,{settings:async()=>({extraFields:[]})},{school(){},permission:async()=>{}},{create:async(school,input)=>{stored.push(input.student);return {enrollment:{id:'enrollment',admissionNumber:'SCH1',sectionId:'section'}};}});
 return {service,stored,queries};
}
test('valid students can be confirmed while invalid and unconfigured classes are excluded',async()=>{
 const {service,stored}=fixture();const input={academicYearId:'year',rows:[row,{...row,firstName:'Missing class',className:'Unknown'},{...row,firstName:'No capacity',className:'Nursery'},{...row,firstName:'Bad mobile',mobile:'wrong'}]};
 const preview=await service.preview('school',input);
 assert.deepEqual(preview.rows.map(r=>r.row),[2]);assert.deepEqual([...new Set(preview.errors.map(e=>e.row))].sort(),[3,4,5]);assert.equal(preview.groups.length,1);
 const result=await service.confirm('school','actor',{...input,expectedPreview:preview.expectedPreview,reason:'Import valid students',approveSections:true});
 assert.equal(result.students,1);assert.deepEqual(result.importedRows,[2]);assert.equal(stored.length,1);assert.equal(stored[0].firstName,'Child');
});
test('duplicate rows and admission numbers are excluded and reuploads find existing students in school/year',async()=>{
 const {service,queries}=fixture();const input={academicYearId:'year',rows:[{...row,admissionNumber:'SCH1'},{...row,firstName:'Different',admissionNumber:'SCH1'},{...row}]};
 const preview=await service.preview('school',input);assert.equal(preview.rows.length,1);assert.equal(preview.errors.length,2);assert.ok(preview.errors.every(e=>/Duplicate/.test(e.message)));
 await service.confirm('school','actor',{...input,expectedPreview:preview.expectedPreview,reason:'Approve valid intake',approveSections:true});
 const repeat=await service.preview('school',{academicYearId:'year',rows:[row]});assert.equal(repeat.rows.length,0);assert.match(repeat.errors[0].message,/already exists/);
 assert.ok(queries.every(q=>q.where.schoolId==='school'&&q.where.academicYearId==='year'));
 await assert.rejects(service.confirm('school','actor',{academicYearId:'year',rows:[row],expectedPreview:repeat.expectedPreview,reason:'Try duplicate',approveSections:true}),/No valid students/);
});
test('confirmation rejects a changed preview',async()=>{
 const {service}=fixture();await assert.rejects(service.confirm('school','actor',{academicYearId:'year',rows:[row],expectedPreview:'0'.repeat(64),reason:'Approve intake',approveSections:true}),/fresh preview/);
});
