const test=require('node:test'),assert=require('node:assert/strict');const{distributePeriods}=require('../dist/timetable/automatic-periods');
test('automatically fills 25 slots for seven subjects',()=>{const counts=distributePeriods(25,[1,1,1,1,1,1,1]);assert.equal(counts.reduce((n,v)=>n+v,0),25);assert.ok(counts.every(n=>n>=3));assert.deepEqual(counts,distributePeriods(25,[1,1,1,1,1,1,1]));});
test('more frequent subjects receive more periods while every subject has a lesson',()=>{const counts=distributePeriods(25,[1,2,3]);assert.ok(counts[2]>counts[1]&&counts[1]>counts[0]);assert.equal(counts.reduce((n,v)=>n+v,0),25);});
test('not enough time to cover every subject gives a clear failure',()=>{assert.throws(()=>distributePeriods(2,[1,1,1]),/only 2 weekly/);});
