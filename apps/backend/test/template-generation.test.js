const test = require('node:test');
const assert = require('node:assert/strict');
const {templateGenerationRules} = require('../dist/timetable/template-generation-rules');
const {generate, validate} = require('../dist/timetable/constraint-engine');
const {distributePeriods} = require('../dist/timetable/automatic-periods');
const fixture=require('./fixtures/shared-teacher-templates.json');

test('eight sections with shared specialist teachers fill all 230 periods deterministically',()=>{
 const c={rules:templateGenerationRules(),slots:[],requirements:[],classTeachers:{},teachers:{},availability:[],external:[],fixed:[]};
 for(let i=0;i<fixture.teachers;i++)c.teachers['teacher'+i]={};
 fixture.sections.forEach((section,i)=>{
  section.periods.forEach((period,p)=>{for(let day=1;day<=5;day++)c.slots.push({...period,id:'s'+i+'p'+p,weekday:day,sequence:p+1,type:'TEACHING',sectionId:'section'+i,classId:'class'+i});});
  section.requirements.forEach(r=>c.requirements.push({sectionId:'section'+i,classId:'class'+i,subjectId:'subject'+r.subject,name:'Subject '+r.subject,weeklyPeriods:r.count,maxPeriodsPerDay:r.daily,allowConsecutive:true,preferredPeriods:[],avoidPeriods:[],teacherIds:r.teachers.map(t=>'teacher'+t),preferredTeacherIds:[],core:false,activity:false}));
 });
 const result=generate(c),again=generate(c);
 assert.equal(result.success,true);assert.equal(result.entries.length,230);
 assert.equal(result.validation.valid,true);assert.equal(result.validation.summary.teacherConflicts,0);
 assert.deepEqual(result.entries,again.entries);
});

test('template generation fills a seven-period day and leaves assembly and break unassigned', () => {
  const c = {rules:templateGenerationRules(),slots:[],requirements:[],classTeachers:{},teachers:{teacher:{}},availability:[],external:[],fixed:[]};
  for (let day=1;day<=5;day++) {
    for (let i=0;i<9;i++) c.slots.push({id:'p'+i,weekday:day,sequence:i,sectionId:'section',classId:'class',type:i===0?'ASSEMBLY':i===4?'BREAK':'TEACHING',startTime:String(9+i).padStart(2,'0')+':00',endTime:String(10+i).padStart(2,'0')+':00'});
  }
  const counts=distributePeriods(35,[1,2]);
  counts.forEach((count,i)=>c.requirements.push({sectionId:'section',classId:'class',subjectId:'subject'+i,name:'Subject '+i,weeklyPeriods:count,maxPeriodsPerDay:Math.ceil(count/5),allowConsecutive:true,preferredPeriods:[],avoidPeriods:[],teacherIds:['teacher'],preferredTeacherIds:[],core:false,activity:false}));
  const result=generate(c);
  assert.equal(result.success,true);
  assert.equal(result.entries.length,35);
  assert.ok(result.entries.every(e=>e.periodSlotId!=='p0'&&e.periodSlotId!=='p4'));
  assert.equal(validate(c,result.entries).valid,true);
  c.external=[{...result.entries[0],sectionId:'other',startTime:'10:00',endTime:'11:00'}];
  assert.equal(generate(c).success,false,'shared teacher overlaps still prevent saving a complete schedule');
});
