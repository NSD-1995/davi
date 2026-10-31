require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {activityTransition,queryTransition,querySummary,parse,createQuery,createActivity}=require('../dist/engagement/engagement.rules');
const {groupCommandActions}=require('../dist/dashboard/dashboard-operations.service');
test('activity execution requires start before completion and terminal states cannot reopen',()=>{
 activityTransition('PLANNED','IN_PROGRESS');activityTransition('IN_PROGRESS','COMPLETED');activityTransition('PLANNED','CANCELLED');
 for(const pair of [['PLANNED','COMPLETED'],['COMPLETED','PLANNED'],['CANCELLED','IN_PROGRESS']])assert.throws(()=>activityTransition(...pair));
});
test('query replies do not imply resolution, parent cannot change lifecycle and resolved records cannot reopen',()=>{
 queryTransition('ASSIGNED','AWAITING_PARENT',false);queryTransition('IN_PROGRESS','RESOLVED',false);
 assert.throws(()=>queryTransition('AWAITING_PARENT','RESOLVED',true));assert.throws(()=>queryTransition('RESOLVED','IN_PROGRESS',false));
});
test('query summaries separate awaiting-parent and resolved states with school-local midnight',()=>{
 const rows=[{status:'NEW',dueAt:new Date('2026-10-29'),assignedToId:null},{status:'AWAITING_PARENT',dueAt:new Date('2026-10-29'),assignedToId:'a'},{status:'RESOLVED',dueAt:new Date('2026-10-29'),resolvedAt:new Date('2026-10-29T20:00:00Z'),assignedToId:'a'}];
 const s=querySummary(rows,'2026-10-30','Asia/Kolkata',new Date('2026-10-30T06:00:00Z'));assert.equal(s.total,2);assert.equal(s.overdue,1);assert.equal(s.awaitingResponse,1);assert.equal(s.resolvedToday,1);assert.equal(s.unassigned,1);
});
test('actions group sections and deduplicate sources without declaring attendance overdue before deadline',()=>{
 const rows=[{key:'attendance:a',title:'A',count:20,href:'/a'},{key:'attendance:b',title:'B',count:30,href:'/b'},{key:'attendance:a',title:'A',count:20,href:'/a'},{key:'cover',title:'Cover',count:2,href:'/cover'}];
 const before=groupCommandActions(rows,{time:'08:00'},'09:30');assert.equal(before.length,2);assert.equal(before[0].key,'cover');assert.equal(before[1].count,50);assert.equal(before[1].items.length,2);assert.equal(before[1].status,'PENDING');
 assert.equal(groupCommandActions(rows,{time:'10:00'},'09:30')[1].status,'OVERDUE');assert.equal(groupCommandActions(rows,{time:'23:00'})[1].status,'PENDING');
});
test('query/activity payloads reject unknown properties and invalid intervals',()=>{
 assert.throws(()=>parse(createQuery,{enrollmentId:'x',category:'Other',subject:'x',message:'x',schoolId:'foreign'}));
 assert.throws(()=>parse(createActivity,{academicYearId:'x',classId:'x',sectionId:'x',teacherId:'x',title:'x',category:'Other',date:'bad',startTime:'10:00',endTime:'09:00'}));
});
test('staff-only holidays do not cancel the student attendance calendar',()=>{
 const {studentDayState}=require('../dist/dashboard/command-center-metrics');
 const date='2026-10-30',section={id:'s',classId:'c'},events=[{eventType:'HOLIDAY',audience:'STAFF',startsAt:new Date(date+'T00:00:00Z')}];
 assert.equal(studentDayState(section,[],[],events,date,'UTC',{},[1,2,3,4,5]),'WORKING');events[0].audience='CLASS:s';assert.equal(studentDayState(section,[],[],events,date,'UTC',{},[1,2,3,4,5]),'HOLIDAY');
});
