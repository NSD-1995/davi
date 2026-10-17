const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../lib/attendance-drafts.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exported={};new Function('exports',compiled)(exported);
const {mergeAttendanceDrafts}=exported;

test('individual save refreshes that person and preserves another unsaved attendance selection',()=>{
 const current={alice:{status:'PRESENT',version:0},bob:{status:'ABSENT',reason:'Confirmed absence',version:1}};
 const incoming={alice:{status:'PRESENT',version:1},bob:{status:'PRESENT',version:1},carol:{status:'NOT_MARKED',version:0}};
 const merged=mergeAttendanceDrafts(current,incoming,new Set(['bob']));
 assert.deepEqual(merged.alice,incoming.alice);
 assert.deepEqual(merged.bob,current.bob);
 assert.deepEqual(merged.carol,incoming.carol);
 assert.equal(current.alice.version,0);
});

test('bulk save refreshes saved rows and keeps other pending edits, including unavailable intervals',()=>{
 const current={a:{status:'PRESENT'},b:{status:'PRESENT'},c:{status:'HALF_DAY',unavailableFrom:'13:00',unavailableUntil:'17:00'}};
 const incoming={a:{status:'PRESENT',version:1},b:{status:'PRESENT',version:1},c:{status:'NOT_MARKED',version:0}};
 assert.deepEqual(mergeAttendanceDrafts(current,incoming,new Set(['c'])),{...incoming,c:current.c});
});

test('refresh removes staff outside the returned roster instead of restoring their stale draft',()=>{
 assert.deepEqual(mergeAttendanceDrafts({removed:{status:'ABSENT'}},{},new Set(['removed'])),{});
});

test('unsaved rows retain their original version so concurrent edits still trigger server conflicts',()=>{
 const result=mergeAttendanceDrafts({bob:{status:'ABSENT',version:1}},{bob:{status:'LATE',version:2}},new Set(['bob']));
 assert.equal(result.bob.version,1);
 assert.equal(result.bob.status,'ABSENT');
});
