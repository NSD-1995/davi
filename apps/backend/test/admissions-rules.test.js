require('reflect-metadata');
const test = require('node:test'), assert = require('node:assert/strict');
const { balancedAllocation, parse, enquirySchema, settingsSchema, checkVersion } = require('../dist/student-admissions/admissions-rules');
test('125 new students balance into five capacity-25 sections without moving occupants', () => {
  const students = Array.from({length:125},(_,index)=>({id:String(index),version:1}));
  const result = balancedAllocation(students,Array.from({length:5},(_,index)=>({id:String.fromCharCode(65+index),capacity:25,occupied:0})));
  assert.equal(result.assignments.length,125); assert.deepEqual(result.distribution.map(row=>row.proposedTotal),[25,25,25,25,25]);
  const occupied = balancedAllocation([{id:'new',version:2}],[{id:'A',capacity:10,occupied:8},{id:'B',capacity:10,occupied:2}]);
  assert.equal(occupied.assignments[0].sectionId,'B'); assert.equal(occupied.assignments[0].version,2);
});
test('capacity shortage and unconfigured capacities cannot create partial allocations', () => {
  assert.throws(()=>balancedAllocation([{id:'x',version:1}],[{id:'A',capacity:1,occupied:1}]),/Insufficient/);
  assert.throws(()=>balancedAllocation([],[{id:'A',capacity:null,occupied:0}]),/Configure/);
});
test('enquiry input normalizes mobile and rejects a client-controlled school or conversion status', () => {
  const data={studentName:'Child',parentName:'Parent',mobile:'+91 98765 43210',academicYearId:'year',classId:'class',source:'PHONE'};
  assert.equal(parse(enquirySchema,data).mobile,'9876543210');
  assert.throws(()=>parse(enquirySchema,{...data,schoolId:'foreign'}));
  assert.throws(()=>parse(enquirySchema,{...data,status:'CONVERTED'}));
  assert.throws(()=>checkVersion(3,2),/changed/);
});
test('overlapping fee rules are rejected and section assignment defaults to optional', () => {
  const base={requireSectionOnJoin:false,formTitle:'Apply',formDescription:'',extraFields:[],requiredDocuments:[],fees:[]};
  assert.equal(parse(settingsSchema,base).requireSectionOnJoin,false);
  const fee={academicYearId:'year',classIds:['class'],amountMinor:1000,mandatory:true,methods:['UPI'],refundPolicy:'Refund on withdrawal',waiverAllowed:false,waiverEligibility:''};
  assert.throws(()=>parse(settingsSchema,{...base,fees:[fee,fee]}),/only one/);
});
test('admissions authorization reads only active roles in the authenticated school', async () => {
  const { AdmissionsSchoolGuard } = require('../dist/student-admissions/admissions-school.guard');
  const guard = new AdmissionsSchoolGuard({getAllAndOverride:()=>['ADMISSIONS_DECIDE']},{userRole:{findMany:async({where})=>{assert.equal(where.schoolId,'own-school');assert.equal(where.role.schoolId,'own-school');assert.equal(where.role.isActive,true);return [];}}});
  const context={switchToHttp:()=>({getRequest:()=>({user:{id:'actor',schoolId:'own-school'}})}),getHandler:()=>{},getClass:()=>{}};
  await assert.rejects(guard.canActivate(context),/active role/);
});
