const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../lib/timetable-overview.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exported={};new Function('exports',compiled)(exported);
const {latestSectionPlans,timetableConflicts}=exported;
const plan=(id,sectionId,time,teacherId='teacher')=>({id,sectionId,status:'DRAFT',version:1,generatedAt:time,entries:[{weekday:1,periodSlotId:'p',teacherId,teacher:{user:{firstName:'Shared',lastName:'Teacher'}}}],template:{slots:[{id:'p',startTime:'09:00',endTime:'09:30'}]}});
const classes=[{name:'LKG',sections:[{id:'a',name:'1'},{id:'b',name:'2'}]}];

test('latest creation is chosen independently for every section',()=>{
 const old=plan('old','a','2026-10-14T01:00:00Z');old.version=10;
 const recent=plan('new','a','2026-10-14T02:00:00Z');recent.status='PUBLISHED';
 const latest=latestSectionPlans([old,recent,plan('b','b','2026-10-14T01:00:00Z')]);
 assert.equal(latest.get('a').id,'new');assert.equal(latest.size,2);
});
test('overlapping teachers are reported for both sections; old versions are excluded',()=>{
 const a=plan('a','a','2026-10-14T02:00:00Z'),b=plan('b','b','2026-10-14T02:00:00Z');
 const issues=timetableConflicts([a,b,plan('old','a','2026-10-14T01:00:00Z')],classes);
 assert.equal(issues.a.length,1);assert.equal(issues.b.length,1);assert.equal(issues.old,undefined);
 assert.match(issues.a[0].message,/Shared Teacher/);assert.ok(issues.a[0].message.includes('LKG / Section 1'));assert.ok(issues.a[0].message.includes('LKG / Section 2'));
 b.entries[0].teacherId='another';assert.deepEqual(timetableConflicts([a,b],classes),{});
});
