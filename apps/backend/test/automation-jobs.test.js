require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {CoverageService}=require('../dist/timetable/coverage.service');
function fixture(admin=true){
 const audits=[],calls=[];const db={auditLog:{create:async q=>audits.push(q)}};
 const service=new CoverageService(db,{}, {actor:async(s,u,p)=>{assert.equal(s,'school');assert.equal(u,'admin');assert.equal(p,'staff.attendance.manage');return {admin};}});
 service.policy=async()=>({timeZone:'Asia/Kolkata',autoAssign:false,missingCheckInEnabled:false});
 service.detectMissingCheckIns=async()=>{calls.push('reminders');return {reminded:0,markedAbsent:0};};
 service.reconcile=async()=>{calls.push('coverage');return {assigned:0,needsSubstitute:1,proposed:2};};
 return {service,audits,calls};
}
test('automation status is school-admin scoped and reports real worker lifecycle',async()=>{
 const {service}=fixture();assert.equal((await service.automationStatus('school','admin')).workerActive,false);
 service.onModuleInit();try{assert.equal((await service.automationStatus('school','admin')).workerActive,true);}finally{service.onModuleDestroy();}
 assert.equal((await service.automationStatus('school','admin')).workerActive,false);
 await assert.rejects(()=>fixture(false).service.automationStatus('school','admin'),/administrator/);
 await assert.rejects(()=>fixture(false).service.runAutomation('school','admin'),/administrator/);
});
test('run now reuses reminder/coverage workers, records results and audits the initiating admin',async()=>{
 const f=fixture();const result=await f.service.runAutomation('school','admin');assert.equal(result.coverage.proposed,2);assert.deepEqual(f.calls,['reminders','coverage']);
 const status=await f.service.automationStatus('school','admin');assert.equal(status.lastRun.state,'SUCCEEDED');assert.ok(status.lastRun.finishedAt);assert.equal(f.audits[0].data.actorId,'admin');assert.equal(f.audits[0].data.schoolId,'school');
});
test('a running school job cannot overlap another manual run and failures remain observable',async()=>{
 const f=fixture();let finish;f.service.reconcile=()=>new Promise(resolve=>finish=resolve);
 const first=f.service.runAutomation('school','admin');await new Promise(resolve=>setImmediate(resolve));await assert.rejects(()=>f.service.runAutomation('school','admin'),/already running/);finish({assigned:0,needsSubstitute:0,proposed:0});await first;
 f.service.reconcile=async()=>{throw Error('temporary failure');};await assert.rejects(()=>f.service.runAutomation('school','admin'),/temporary failure/);assert.equal((await f.service.automationStatus('school','admin')).lastRun.state,'FAILED');
});
