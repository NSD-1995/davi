const test=require('node:test'),assert=require('node:assert/strict');
const {attendanceDefaults,haversineMetres,verifyAttendanceLocation,effectiveAttendancePolicy,validateAttendancePolicy}=require('../dist/attendance/attendance-policy');
const {defaultLeavePolicy,leaveCreditSchedule,validateLeavePolicies}=require('../dist/attendance/leave-policy');
const {unavailableForLesson}=require('../dist/timetable/coverage-engine');
const {zonedInstant,localClock}=require('../dist/timetable/coverage.service');
const d=s=>new Date(s+'T00:00:00Z');
test('GPS validates server-calculated distance and uncertainty, including zero coordinates',()=>{
 const policy={...attendanceDefaults,locationVerificationEnabled:true,schoolLatitude:0,schoolLongitude:0};
 assert.equal(verifyAttendanceLocation(policy,{location:{latitude:0,longitude:0,accuracy:5}}).locationVerified,true);
 assert.ok(Math.abs(haversineMetres(0,0,0,1)-111195)<2);
 assert.throws(()=>verifyAttendanceLocation(policy,{location:{latitude:1,longitude:0,accuracy:5},distance:0}),/outside/);
 assert.throws(()=>verifyAttendanceLocation(policy,{location:{latitude:0,longitude:0,accuracy:100}}),/accuracy/);
 for(const location of [{latitude:NaN,longitude:0,accuracy:5},{latitude:91,longitude:0,accuracy:5},{latitude:0,longitude:0,accuracy:-1},{}])assert.throws(()=>verifyAttendanceLocation(policy,{location}),/valid device/);
 assert.deepEqual(verifyAttendanceLocation(attendanceDefaults,{}),{locationVerified:false});
});
test('staff shift takes precedence over department and legacy self-attendance is preserved',()=>{
 const base={...attendanceDefaults,selfAttendanceEnabled:true,departmentOptionId:'dept',attendanceShifts:[{name:'Department',departmentValues:['Office'],policy:{checkInTime:'08:00'}},{name:'Individual',staffIds:['s'],policy:{checkInTime:'10:00'}}]};
 assert.equal(effectiveAttendancePolicy(base,{id:'s',user:{profileOptions:[{optionId:'dept',value:'Office'}]}}).checkInTime,'10:00');
 assert.equal(effectiveAttendancePolicy(base,{id:'other',user:{profileOptions:[{optionId:'dept',value:'Office'}]}}).checkInTime,'08:00');
 assert.equal(effectiveAttendancePolicy(base,{}).attendanceMode,'BOTH');
 assert.throws(()=>validateAttendancePolicy({...attendanceDefaults,locationVerificationEnabled:true}),/coordinates/);
});
test('monthly credits are idempotency-keyed and never include future months',()=>{
 const p={...defaultLeavePolicy,allocation:'MONTHLY',days:2,creditDay:31};
 const credits=leaveCreditSchedule(p,d('2026-01-01'),d('2026-12-31'),d('2026-03-01'));
 assert.deepEqual(credits.map(c=>[c.key,c.date.toISOString().slice(0,10),c.days]),[['2026-01','2026-01-31',2],['2026-02','2026-02-28',2]]);
 assert.equal(leaveCreditSchedule(p,d('2026-01-01'),d('2026-12-31'),d('2025-12-31')).length,0);
});
test('annual and monthly new-joiner proration respects leap years and academic periods',()=>{
 const p={...defaultLeavePolicy,days:366,prorateNewJoiners:true};
 assert.equal(leaveCreditSchedule(p,d('2024-01-01'),d('2024-12-31'),d('2024-07-01'),d('2024-07-01'))[0].days,184);
 const monthly=leaveCreditSchedule({...p,allocation:'MONTHLY',days:31},d('2026-04-01'),d('2027-03-31'),d('2026-05-20'),d('2026-05-16'));
 assert.equal(monthly.length,1);assert.equal(monthly[0].days,16);
 assert.equal(leaveCreditSchedule(p,d('2026-04-01'),d('2027-03-31'),d('2026-04-01'),d('2027-04-01')).length,0);
 assert.throws(()=>validateLeavePolicies([{...p,leaveType:'Sick',creditDay:0}],['Sick']),/Invalid/);
});
test('late self punches do not confirm original-teacher unavailability',()=>{
 for(const source of ['SELF_CHECKIN','SELF_CHECKOUT'])assert.equal(unavailableForLesson({status:'LATE',source,checkInTime:'10:00'},{startTime:'09:00',endTime:'09:45'},false),false);
 assert.equal(unavailableForLesson({status:'ABSENT'},{startTime:'09:00'},false),true);
});
test('exception times use the school timezone across UTC date boundaries',()=>{
 const instant=zonedInstant('2026-10-17','00:15','Asia/Kolkata');assert.equal(instant.toISOString(),'2026-10-16T18:45:00.000Z');assert.deepEqual(localClock(instant,'Asia/Kolkata'),{date:'2026-10-17',time:'00:15'});
});
