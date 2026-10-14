require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {responsibilityError,teachingExclusion}=require('../dist/teaching-responsibilities');
const {eligibleTeachers}=require('../dist/timetable/teacher-capabilities');
const {rankCandidates}=require('../dist/timetable/coverage-engine');
const {AcademicGroupSetupService}=require('../dist/timetable/academic-group-setup.service');
const {TeachersService}=require('../dist/teachers/teachers.service');
const subjects=[{id:'english',name:'English',academicGroups:['PRE_PRIMARY','PRIMARY'],status:'ACTIVE'},{id:'math',name:'Mathematics',academicGroups:['PRIMARY'],status:'ACTIVE'}];
const classes=[{id:'c1',name:'1st Standard',schoolId:'school'},{id:'c3',name:'3rd Standard',schoolId:'school'}];
const teacher={id:'ananya',schoolId:'school',status:'ACTIVE',user:{status:'ACTIVE'},capableSubjectIds:['english','math'],timetableEligibility:{canSubstitute:true,groupResponsibilities:[{groupId:'PRE_PRIMARY',subjectIds:['english'],classIds:null},{groupId:'PRIMARY',subjectIds:['math'],classIds:null}],academicGroups:['PRE_PRIMARY','PRIMARY']}};

test('one teacher has different subjects in Pre-primary and Primary',()=>{
 assert.equal(teachingExclusion(teacher,'c1',classes[0],'english'),null);
 assert.match(teachingExclusion(teacher,'c1',classes[0],'math'),/not assigned/);
 assert.equal(teachingExclusion(teacher,'c3',classes[1],'math'),null);
 assert.match(teachingExclusion(teacher,'c3',classes[1],'english'),/not assigned/);
 assert.match(teachingExclusion(teacher,'middle',{name:'Class 7'},'math'),/Not responsible/);
 assert.deepEqual(eligibleTeachers('math',[teacher],[{teacherId:teacher.id}],[],'c1',classes[0]),[]);
});
test('explicit no responsibilities prevents legacy allocation fallback',()=>{
 const disabled={...teacher,timetableEligibility:{groupResponsibilities:[]}};
 assert.deepEqual(eligibleTeachers('english',[disabled],[{teacherId:teacher.id}],[],'c1',classes[0]),[]);
});
test('responsibilities reject cross-group subjects, foreign classes and duplicate groups',()=>{
 assert.match(responsibilityError([{groupId:'PRE_PRIMARY',subjectIds:['math'],classIds:null}],subjects,classes),/subjects must belong/);
 assert.match(responsibilityError([{groupId:'PRIMARY',subjectIds:['math'],classIds:['c1']}],subjects,classes),/classes must belong/);
 assert.match(responsibilityError([{groupId:'PRIMARY',subjectIds:['math'],classIds:['foreign']}],subjects,classes),/classes must belong/);
 assert.match(responsibilityError([teacher.timetableEligibility.groupResponsibilities[0],teacher.timetableEligibility.groupResponsibilities[0]],subjects,classes),/only once/);
});
test('substitution respects group-specific subjects and bookings in other compartments',()=>{
 const target={key:'target',teacherId:'absent',classId:'c1',className:'1st Standard',subjectId:'english',slotId:'slot',startTime:'09:00',endTime:'09:40'};
 const context={teachers:[{...teacher,weeklyLoad:0}],attendance:{ananya:{status:'PRESENT',checkInTime:'08:00'}},bookings:[],availability:[],weekday:1,requirePresent:true,rules:{maxTeacherPeriodsPerDay:6,maxTeacherPeriodsPerWeek:30}};
 assert.equal(rankCandidates(context,target).candidates.length,1);
 assert.equal(rankCandidates(context,{...target,subjectId:'math'}).candidates.length,0);
 assert.equal(rankCandidates({...context,bookings:[{key:'primary-lesson',teacherId:'ananya',startTime:'09:00',endTime:'09:40'}]},target).candidates.length,0);
});
test('generation coordinates a shared teacher across compartments with one daily workload limit',()=>{
 const {generate,defaultRules}=require('../dist/timetable/constraint-engine');
 const c={rules:{...defaultRules,classTeacherRequired:false,classTeacherFirstPeriodPriority:'DISABLED'},slots:[],requirements:[],classTeachers:{},teachers:{ananya:{maxPeriodsPerDay:2}},availability:[],external:[],fixed:[]};
 for(const [index,subjectId] of ['english','math'].entries()){
  const schoolClass=classes[index],sectionId='section'+index;
  for(let period=0;period<2;period++)c.slots.push({id:'p'+period,weekday:1,sequence:period+1,startTime:`${9+period}:00`.padStart(5,'0'),endTime:`${10+period}:00`,type:'TEACHING',classId:schoolClass.id,sectionId});
  c.requirements.push({sectionId,classId:schoolClass.id,subjectId,name:subjectId,weeklyPeriods:1,maxPeriodsPerDay:1,allowConsecutive:true,preferredPeriods:[],avoidPeriods:[],teacherIds:eligibleTeachers(subjectId,[teacher],[],[],schoolClass.id,schoolClass),preferredTeacherIds:[],core:true,activity:false});
 }
 const result=generate(c);assert.equal(result.success,true);assert.equal(result.entries.length,2);assert.notEqual(result.entries[0].periodSlotId,result.entries[1].periodSlotId);
 c.teachers.ananya.maxPeriodsPerDay=1;assert.equal(generate(c).success,false);
});

function fixture(){
 let current=structuredClone(teacher),writes=0;
 const api={subject:{findMany:async({where})=>subjects.filter(s=>!where.id||where.id.in.includes(s.id))},schoolClass:{findMany:async({where})=>classes.filter(c=>!where.id||where.id.in.includes(c.id))},academicYear:{findFirst:async()=>({id:'year'})},teacher:{findUnique:async()=>structuredClone(current),update:async({data})=>{current={...current,...structuredClone(data)};writes++;return structuredClone(current)}}};
 const db={...api,$transaction:async callback=>{const before=structuredClone(current);try{return await callback(api)}catch(e){current=before;throw e}}};
 return{db,get:()=>current,writes:()=>writes};
}
test('group table saves one compartment and retains the teacher’s other responsibility',async()=>{
 const f=fixture();await new AcademicGroupSetupService(f.db).save('school',{academicYearId:'year',groupId:'PRIMARY',assignments:[{teacherId:'ananya',subjectIds:['english','math'],classIds:['c3'],canSubstitute:true}]});
 const rows=f.get().timetableEligibility.groupResponsibilities;
 assert.deepEqual(rows.find(r=>r.groupId==='PRE_PRIMARY'),teacher.timetableEligibility.groupResponsibilities[0]);
 assert.deepEqual(rows.find(r=>r.groupId==='PRIMARY').subjectIds,['english','math']);
 assert.equal(teachingExclusion(f.get(),'c1',classes[0],'math'),'Subject is not assigned in this academic group');
});
test('profile save stores union capabilities and responsibilities in the same transaction',async()=>{
 const f=fixture();await new TeachersService(f.db).saveTeachingSetup('ananya','school',{groupResponsibilities:[{groupId:'PRE_PRIMARY',subjectIds:['english'],classIds:null},{groupId:'PRIMARY',subjectIds:['math'],classIds:null}],allowedClassIds:null,preferredClassIds:[],canSubstitute:true});
 assert.deepEqual(f.get().capableSubjectIds,['english','math']);assert.equal(f.get().timetableEligibility.groupResponsibilities.length,2);
});
test('a failed group table batch rolls back previous teacher changes',async()=>{
 const f=fixture();await assert.rejects(new AcademicGroupSetupService(f.db).save('school',{academicYearId:'year',groupId:'PRE_PRIMARY',assignments:[{teacherId:'ananya',subjectIds:['english'],classIds:['c1'],canSubstitute:false},{teacherId:'second',subjectIds:['math'],classIds:null,canSubstitute:true}]}),/subjects must belong/);
 assert.equal(f.get().timetableEligibility.canSubstitute,true);assert.deepEqual(f.get().timetableEligibility.groupResponsibilities,teacher.timetableEligibility.groupResponsibilities);
});

function setupFixture(){
 const db={academicYear:{findFirst:async()=>({id:'year',status:'ACTIVE'})},schoolSetting:{findUnique:async()=>null},schoolClass:{findMany:async()=>classes.map(c=>({...c,sections:[{id:'s'+c.id,name:'A',status:'ACTIVE'}]}))},subject:{findMany:async()=>subjects},teacher:{findMany:async()=>[teacher]},classSubject:{findMany:async()=>[{classId:'c1',subjectId:'english',eligibleTeacherIds:[],requiredPeriodsPerWeek:2},{classId:'c3',subjectId:'math',eligibleTeacherIds:[],requiredPeriodsPerWeek:2}]},teacherAcademicAssignment:{findMany:async()=>[]},periodTemplateAssignment:{findMany:async()=>[]}};
 return db;
}
test('readiness reports missing timings and class teachers for only the selected group',async()=>{
 const result=await new AcademicGroupSetupService(setupFixture()).workspace('school','year','PRE_PRIMARY');
 assert.equal(result.classes.length,1);assert.equal(result.classes[0].id,'c1');assert.equal(result.ready,false);
 assert.ok(result.issues.some(i=>i.message.includes('school timings')));assert.ok(result.issues.some(i=>i.message.includes('class teacher')));
 assert.equal(result.issues.some(i=>i.message.includes('no responsible teacher')),false);
});
test('readiness catches a subject capability that is assigned only in another group',async()=>{
 const db=setupFixture();db.classSubject.findMany=async()=>[{classId:'c3',subjectId:'english',eligibleTeacherIds:[],requiredPeriodsPerWeek:2}];
 const result=await new AcademicGroupSetupService(db).workspace('school','year','PRIMARY');
 assert.ok(result.issues.some(i=>i.message.includes('no responsible teacher for English')));
});
test('generation rejects an empty or invalid group instead of falling back to the whole school',async()=>{
 const {TimetableRulesService}=require('../dist/timetable/timetable-rules.service');
 const db={academicYear:{findFirst:async()=>({id:'year'})},section:{findMany:async()=>[{id:'secondary',classId:'c9',schoolClass:{name:'9th Standard'}}]}};
 const service=new TimetableRulesService(db);
 await assert.rejects(service.context('school',{academicYearId:'year',groupId:'INVALID'}),/valid academic group/);
 await assert.rejects(service.context('school',{academicYearId:'year',groupId:'PRE_PRIMARY'}),/Every requested section/);
});
test('bulk subject classification rejects foreign records before updating anything',async()=>{
 let saved=false;const db={$transaction:async callback=>callback({subject:{findMany:async()=>[],updateMany:async()=>{saved=true}}})};
 await assert.rejects(new AcademicGroupSetupService(db).classifySubjects('school',{subjectIds:['foreign'],academicGroups:['PRIMARY']}),/belong to your school/);assert.equal(saved,false);
});
