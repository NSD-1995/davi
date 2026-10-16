require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {externalTimetablePlanIds}=require('../dist/timetable/external-timetable-plans');
const {TimetableRulesService}=require('../dist/timetable/timetable-rules.service');
const {generate}=require('../dist/timetable/constraint-engine');
const plan=(id,sectionId,status,time,version=1)=>({id,sectionId,status,generatedAt:new Date(time),version,template:{slots:[]},supervisionEntries:[]});
test('latest drafts reserve teachers while history does not and published commitments remain',()=>{
 const rows=[plan('old','s','DRAFT','2026-10-10'),plan('new','s','DRAFT','2026-10-16',2),plan('published','s','PUBLISHED','2026-10-09'),plan('archived','other','ARCHIVED','2026-10-17'),plan('other','other','DRAFT','2026-10-15')];
 assert.deepEqual([...externalTimetablePlanIds(rows)].sort(),['new','other','published']);
});
function fixture(){
 const slot={id:'selected-slot',name:'Lesson',type:'TEACHING',sequence:1,startTime:'09:15',endTime:'09:45',applicableDays:[1]};
 const template={id:'template',workingDays:[1],schoolStartTime:'09:00',schoolEndTime:'10:00',slots:[slot]};
 const rows=[plan('old','other','DRAFT','2026-10-10'),plan('new','other','DRAFT','2026-10-16',2)];
 const entries=rows.map(p=>({timetablePlanId:p.id,sectionId:'other',classId:'other-class',subjectId:'math',teacherId:p.id==='new'?'busy':'free',weekday:1,periodSlotId:'different-slot-id',periodSlot:{startTime:'09:30',endTime:'10:00'}}));
 const db={academicYear:{findFirst:async()=>({id:'year'})},section:{findMany:async()=>[{id:'selected',classId:'class',name:'A',schoolClass:{name:'UKG',academicGroup:'MONTESSORI'}}]},classSubject:{findMany:async()=>[{classId:'class',subjectId:'math',subject:{name:'Math',academicGroups:[]},eligibleTeacherIds:[],preferredTeacherIds:[],requiredPeriodsPerWeek:1,maxPeriodsPerDay:1}]},teacherAcademicAssignment:{findMany:async()=>[]},teacher:{findMany:async()=>['busy','free'].map(id=>({id,capableSubjectIds:['math']}))},timetableEntry:{findMany:async()=>entries},timetablePlan:{findMany:async()=>rows},periodTemplateAssignment:{findMany:async()=>[{sectionId:null,template}]}};
 return new TimetableRulesService(db);
}
test('class generation avoids latest external drafts by actual template times, ignoring old draft bookings',async()=>{
 const {c,templates}=await fixture().context('school',{academicYearId:'year',classId:'class',sectionIds:['selected'],date:'2026-10-16'});
 assert.equal(templates.get('selected').id,'template');
 assert.equal(c.external.length,1);assert.equal(c.external[0].teacherId,'busy');
 const result=generate(c);assert.equal(result.success,true);assert.equal(result.entries.length,1);assert.equal(result.entries[0].teacherId,'free');assert.equal(result.entries[0].periodSlotId,'selected-slot');
});
