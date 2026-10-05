require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const{allocate,rangesOverlap}=require('../dist/timetable/timetable-planning.service');
const slots=[{id:'p1',sequence:1,startTime:'09:30',endTime:'10:00'},{id:'p2',sequence:2,startTime:'10:00',endTime:'10:30'}];
test('detects exact and partial teacher overlaps across timing templates',()=>{assert.equal(rangesOverlap('09:30','10:00','09:30','10:00'),true);assert.equal(rangesOverlap('09:30','10:00','09:45','10:15'),true);assert.equal(rangesOverlap('09:30','10:00','10:00','10:30'),false)});
test('same teacher can teach different non-overlapping periods',()=>{const blocked=new Set(['t1:1:p1']);const result=allocate([{subjectId:'english',primaryTeacherId:'t1',weeklyPeriods:1,maxConsecutive:1}],[1],slots,blocked);assert.equal(result.entries[0].periodSlotId,'p2')});
test('maximum periods per day produces an unresolved requirement',()=>{const result=allocate([{subjectId:'english',primaryTeacherId:'t1',weeklyPeriods:2,maxPeriodsPerDay:1,maxConsecutive:2}],[1],slots);assert.match(result.conflicts[0],/MISSING_PERIODS:english:1/)});
test('section never receives two subjects in one teaching slot',()=>{const result=allocate([{subjectId:'english',primaryTeacherId:'t1',weeklyPeriods:1},{subjectId:'art',primaryTeacherId:'t2',weeklyPeriods:1}],[1],slots);assert.equal(new Set(result.entries.map(x=>x.periodSlotId)).size,2)});
