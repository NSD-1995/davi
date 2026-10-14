require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {academicGroup,validGroups,subjectInGroup}=require('../dist/academic-groups');
const {eligibleTeachers}=require('../dist/timetable/teacher-capabilities');
const {TeachersService}=require('../dist/teachers/teachers.service');
const {SchoolClassesService}=require('../dist/classes/classes.service');
const {TeachingAssignmentsService}=require('../dist/class-workspace/teaching-assignments.service');

test('six groups have no overlap, including Class 8',()=>{
 const expected=['PRE_PRIMARY','PRE_PRIMARY','PRIMARY','PRIMARY','PRIMARY','MIDDLE','MIDDLE','MIDDLE','SECONDARY','SECONDARY','SENIOR_SECONDARY','SENIOR_SECONDARY'];
 expected.forEach((group,index)=>assert.equal(academicGroup({name:`Class ${index+1}`}),group));
 for(const name of ['Play School','Nursery','LKG','UKG'])assert.equal(academicGroup({name}),'MONTESSORI');
 assert.equal(academicGroup({name:'Custom group',academicGroup:'PRIMARY'}),'PRIMARY');
 assert.equal(academicGroup({name:'Unknown'}),null);
 assert.equal(validGroups(['PRIMARY','INVALID']),false);assert.equal(validGroups(['PRIMARY','PRIMARY']),false);
});
test('quick setup creates all sixteen classes exactly once',()=>{
 const names=new SchoolClassesService({}).getStandardClassNames({montessori:true,prePrimary:true,primary:true,middle:true,secondary:true,seniorSecondary:true});
 assert.equal(names.length,16);assert.equal(new Set(names).size,16);
});
test('generation intersects group responsibility, subject capability and explicit class restrictions',()=>{
 const teachers=[
  {id:'montessori',capableSubjectIds:['english'],timetableEligibility:{academicGroups:['MONTESSORI']}},
  {id:'primary',capableSubjectIds:['english'],timetableEligibility:{academicGroups:['PRIMARY']}},
  {id:'shared',capableSubjectIds:['english'],timetableEligibility:{academicGroups:['PRIMARY','MIDDLE']}},
  {id:'restricted',capableSubjectIds:['english'],timetableEligibility:{academicGroups:['PRIMARY'],allowedClassIds:['other']}},
 ];
 assert.deepEqual(eligibleTeachers('english',teachers,[],[],'class3',{name:'3rd Standard'}),['primary','shared']);
 assert.deepEqual(eligibleTeachers('english',teachers,[{teacherId:'montessori'}],[],'class8',{name:'8th Standard'}),['shared']);
 assert.deepEqual(eligibleTeachers('english',teachers,[],[],'new-custom-class',{name:'Custom',academicGroup:'MONTESSORI'}),['montessori']);
});
test('subjects can be shared across groups and old subjects remain available',()=>{
 assert.equal(subjectInGroup({academicGroups:['PRIMARY','MIDDLE']},'PRIMARY'),true);
 assert.equal(subjectInGroup({academicGroups:['PRIMARY']},'SECONDARY'),false);
 assert.equal(subjectInGroup({academicGroups:[]},'MONTESSORI'),true);
});
test('changing teacher groups replaces old groups and preserves other teaching settings',async()=>{
 let saved;
 const db={teacher:{findUnique:async()=>({schoolId:'school',timetableEligibility:{academicGroups:['PRIMARY'],capabilitiesConfigured:true}}),update:async({data})=>(saved=data)},schoolClass:{findMany:async()=>[]}};
 await new TeachersService(db).saveEligibility('teacher','school',{academicGroups:['MONTESSORI'],allowedClassIds:null,preferredClassIds:[],canSubstitute:false});
 assert.deepEqual(saved.timetableEligibility.academicGroups,['MONTESSORI']);assert.equal(saved.timetableEligibility.capabilitiesConfigured,true);
});
test('rejects subjects outside teacher responsibility before saving teaching setup',async()=>{
 const db={subject:{findMany:async()=>[{id:'physics',academicGroups:['SENIOR_SECONDARY']}]}};
 await assert.rejects(new TeachersService(db).saveTeachingSetup('teacher','school',{academicGroups:['MONTESSORI'],subjectIds:['physics']}),/teacher academic groups/);
});
test('workspace rejects cross-group teacher even when subject capability matches',async()=>{
 const db={classSubject:{count:async()=>1},staff:{findMany:async()=>[{id:'staff',user:{status:'ACTIVE',teacher:{id:'teacher',status:'ACTIVE'}}}]},teacher:{findMany:async()=>[{id:'teacher',capableSubjectIds:['english'],timetableEligibility:{academicGroups:['SECONDARY']}}]}};
 const service=new TeachingAssignmentsService(db);service.scope=async()=>({name:'LKG'});
 await assert.rejects(service.replaceSubjectTeachers('school','year','class','section',{assignments:[{subjectId:'english',staffId:'staff',assignmentRole:'PRIMARY'}]}),/Selected teacher/);
});
