require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {DashboardCommandService}=require('../dist/dashboard/dashboard-command.service');
const {studentDayState,studentAttendanceSnapshot,canApproveLeaveType}=require('../dist/dashboard/command-center-metrics');
const {OperationsAccessService}=require('../dist/auth/operations-access.service');
const year={id:'11111111-1111-4111-8111-111111111111',name:'2026–2027',startDate:new Date('2026-04-01'),endDate:new Date('2027-03-31')};
const section={id:'section-a',name:'A',classId:'class-a',className:'Nursery'};
const students=Array.from({length:4},(_,i)=>({id:'e'+i,classId:'class-a',sectionId:'section-a'}));
function fixture(options={}){
 const calls=[];const actor={schoolId:'school-a',userId:'user-a',admin:options.admin!==false,permissions:new Set(options.permissions||[]),scope:options.scope||null};
 const rows={school:{id:'school-a',name:'School A',shortName:'SA'},year:options.noYear?null:year,classes:options.newSchool?[]:[{id:'class-a',name:'Nursery',academicGroup:'MONTESSORI',sections:[{...section,className:undefined}]}],students:options.newSchool?[]:students,attendance:options.records||[{enrollmentId:'e0',status:'PRESENT'},{enrollmentId:'e1',status:'ABSENT'}],events:options.events||[],plans:[{id:'plan',classId:'class-a',sectionId:'section-a',status:'PUBLISHED',entries:[],template:{workingDays:[1,2,3,4,5,6,7]}}],templates:[{classId:'class-a',sectionId:'section-a',template:{workingDays:[1,2,3,4,5,6,7]}}]};
 const db={};const delegates={school:{findFirst:()=>rows.school},academicYear:{findFirst:()=>rows.year},schoolSetting:{findUnique:()=>({timezone:'Asia/Kolkata',logoUrl:null})},schoolClass:{findMany:()=>rows.classes},schoolEvent:{findMany:()=>rows.events},studentEnrollment:{findMany:()=>rows.students},studentAttendance:{findMany:()=>{if(options.attendanceError)throw Error('database unavailable');return rows.attendance;}},periodTemplateAssignment:{findMany:()=>rows.templates},timetablePlan:{findMany:()=>rows.plans},subject:{count:()=>options.newSchool?0:3},staff:{count:()=>options.newSchool?0:4},role:{count:()=>options.newSchool?0:1},staffLeaveRequest:{findMany:()=>[{id:'leave-1',staffId:'staff1',status:'PENDING',leaveType:'Sick',staff:{userId:'other'}},{id:'own',staffId:'own',status:'PENDING',leaveType:'Sick',staff:{userId:'user-a'}},{id:'approved',staffId:'staff1',status:'APPROVED',leaveType:'Sick',staff:{userId:'other'}}]},timetableSubstitution:{findMany:()=>[{targetKey:'lesson:1',timetableEntryId:'lesson1'}]},homework:{findMany:()=>[{id:'hw',title:'Story review',classId:'class-a',sectionId:'section-a',_count:{submissions:2}}]},teacherAcademicAssignment:{findMany:()=>[]},lessonPlan:{findMany:()=>[]},studentMark:{findMany:()=>[]},exam:{findMany:()=>[]},classAnnouncement:{findMany:()=>[]}};
 for(const [model,methods]of Object.entries(delegates)){db[model]={};for(const [method,fn]of Object.entries(methods))db[model][method]=async query=>{calls.push({model,method,query});return fn(query);};}
 const access={actor:async(s,u,p)=>{assert.equal(s,'school-a');assert.equal(u,'user-a');assert.equal(p,'DASHBOARD_VIEW');if(options.deny)throw Error('Missing permission');return actor;},staff:async()=>({rows:[{id:'staff1'},{id:'own'}],actor}),matchesTarget:OperationsAccessService.prototype.matchesTarget};
 const staff={roster:async()=>({calendarStatus:'WORKING',rows:[{staffCategory:'TEACHING',attendance:{status:'PRESENT'}},{staffCategory:'TEACHING',attendance:{status:'NOT_MARKED'}}]}),policy:async()=>({leaveApproverIds:[],leavePolicies:[]})};
 const operations={tasks:async()=>[{id:'task',title:'Office review',status:'ASSIGNED'},{id:'done',status:'COMPLETED'}],effective:async()=>({holiday:false,lessons:[{key:'lesson:1',entryId:'lesson1',status:'UNCOVERED'}]})};
 return {rows,calls,service:new DashboardCommandService(db,access,{policy:async()=>({timeZone:'Asia/Kolkata'})},staff,operations)};
}
test('configured school exposes correct year/local date, setup and partial attendance without inferred absence',async()=>{
 const f=fixture(),data=await f.service.get('school-a','user-a',year.id,new Date('2026-10-24T20:00:00Z'));
 assert.equal(data.clock.date,'2026-10-25');assert.equal(data.setup.complete,true);assert.equal(data.attendance.percentage,50);assert.equal(data.attendance.notMarked,2);assert.equal(data.attendance.statuses.ABSENT,1);assert.equal(data.attendance.sections[0].completion,50);assert.ok(data.actions.some(a=>a.key==='attendance:section-a'));assert.equal(data.pendingTasks,1);assert.equal(data.leaves.pending,1);assert.equal(data.cover.pending,1);
 const attendanceQuery=f.calls.find(c=>c.model==='studentAttendance').query;assert.equal(attendanceQuery.where.schoolId,'school-a');assert.equal(attendanceQuery.where.enrollment.academicYearId,year.id);assert.equal(attendanceQuery.where.date.toISOString(),'2026-10-25T00:00:00.000Z');
});
test('new school retains incomplete seven-step setup with no invented attendance',async()=>{const f=fixture({noYear:true,newSchool:true});const data=await f.service.get('school-a','user-a');assert.equal(data.setup.total,7);assert.equal(data.setup.complete,false);assert.ok(data.setup.outstanding>0);assert.equal(data.attendance,null);assert.equal(data.academicYear,null);assert.equal(data.sources.attendance,'not-configured');});
test('missing attendance is unknown percentage and never an absence',()=>{
 const data=studentAttendanceSnapshot(students,[],[section],{'section-a':'WORKING'});assert.equal(data.percentage,null);assert.equal(data.notMarked,4);assert.equal(data.statuses.ABSENT,0);
});
test('fully marked recorded-zero attendance remains zero rather than unavailable',()=>{
 const data=studentAttendanceSnapshot(students,students.map(s=>({enrollmentId:s.id,status:'ABSENT'})),[section],{'section-a':'WORKING'});assert.equal(data.percentage,0);assert.equal(data.notMarked,0);assert.equal(data.sections[0].completion,100);
});
test('excused, late and half-day credit follow the existing report formula',()=>{
 const data=studentAttendanceSnapshot(students,[{enrollmentId:'e0',status:'EXCUSED'},{enrollmentId:'e1',status:'LATE'},{enrollmentId:'e2',status:'HALF_DAY'},{enrollmentId:'e3',status:'ABSENT'}],[section],{'section-a':'WORKING'});assert.equal(data.percentage,50);assert.equal(data.notMarked,0);
});
test('holiday suppresses pending student attendance actions',async()=>{
 const f=fixture({events:[{id:'holiday',title:'School holiday',eventType:'HOLIDAY',audience:'ALL',startsAt:new Date('2026-10-25T00:00:00Z'),endsAt:null}]});const data=await f.service.get('school-a','user-a',year.id,new Date('2026-10-25T06:00:00Z'));assert.equal(data.dayStates['section-a'],'HOLIDAY');assert.equal(data.attendance.expected,0);assert.equal(data.attendance.percentage,null);assert.ok(!data.actions.some(a=>a.key.startsWith('attendance:')));
});
test('calendar follows configured Sunday, weekly off, missing templates and academic-year limits',()=>{
 const sunday='2026-10-25';assert.equal(studentDayState(section,[{classId:'class-a',sectionId:'section-a',template:{workingDays:[7]}}],[],[],sunday,'Asia/Kolkata',year),'WORKING');assert.equal(studentDayState(section,[],[],[],sunday,'Asia/Kolkata',year,[1,2,3,4,5]),'WEEKLY_OFF');assert.equal(studentDayState(section,[],[],[],sunday,'Asia/Kolkata',year),'NOT_CONFIGURED');assert.equal(studentDayState(section,[],[],[],'2028-01-01','Asia/Kolkata',year,[1,2,3,4,5]),'OUTSIDE_YEAR');
});
test('optional source errors preserve the rest of the dashboard and never become zeros',async()=>{const f=fixture({attendanceError:true});const data=await f.service.get('school-a','user-a',year.id);assert.equal(data.attendance,null);assert.equal(data.sources.attendance,'unavailable');assert.ok(data.errors.attendance);assert.equal(data.counts.students,4);assert.equal(data.staff.statuses.PRESENT,1);assert.ok(!data.actions.some(a=>a.key.startsWith('attendance:')));});
test('restricted roles never query unauthorized academic reviews, staff or role data',async()=>{
 const f=fixture({admin:false,permissions:['DASHBOARD_VIEW'],scope:{schoolWide:false,classIds:[],sectionIds:[],groupIds:[]}});const data=await f.service.get('school-a','user-a',year.id);assert.deepEqual(data.actions,[]);assert.equal(data.attendance,null);assert.equal(data.staff,null);assert.equal(data.counts.roles,null);assert.ok(!f.calls.some(c=>['homework','lessonPlan','studentMark','staffLeaveRequest','role'].includes(c.model)));
});
test('class scope is enforced in student and action source queries',async()=>{
 const f=fixture({admin:false,permissions:['DASHBOARD_VIEW','ATTENDANCE_VIEW','ATTENDANCE_MARK','CLASS_VIEW'],scope:{schoolWide:false,classIds:['class-a'],sectionIds:[],groupIds:[]}});await f.service.get('school-a','user-a',year.id);const query=f.calls.find(c=>c.model==='studentEnrollment').query;assert.deepEqual(query.where.sectionId,{in:['section-a']});
});
test('foreign or invalid academic years and denied dashboard access fail before operational reads',async()=>{
 const f=fixture({noYear:true});await assert.rejects(()=>f.service.get('school-a','user-a',year.id),/outside your school/);assert.ok(!f.calls.some(c=>c.model==='studentAttendance'));
 await assert.rejects(()=>fixture().service.get('school-a','user-a','bad-id'),/valid academic year/);await assert.rejects(()=>fixture({deny:true}).service.get('school-a','user-a'),/Missing permission/);
});
test('approver policy and self-approval rules cannot create unauthorized leave actions',()=>{
 const policy={leaveApproverIds:['manager'],leavePolicies:[{leaveType:'Medical',approverIds:['medical-manager']}]};assert.equal(canApproveLeaveType(policy,'manager',false,'Medical'),false);assert.equal(canApproveLeaveType(policy,'medical-manager',false,'Medical'),true);assert.equal(canApproveLeaveType(policy,'other',true,'Medical'),true);
});
