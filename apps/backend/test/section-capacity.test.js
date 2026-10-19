require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {effectiveCapacity,capacityAllocation,capacityPolicySchema}=require('../dist/student-admissions/capacity-rules');
const c={id:'grade',academicYearId:'year',academicGroup:'PRIMARY'};
test('smallest applicable maximum and largest reservation determine usable seats',()=>{
 const policy={defaultCapacity:40,rules:[{academicYearId:'year',level:'GRADE',target:'grade',maximum:35,reserved:2},{academicYearId:'year',level:'CLASSROOM',target:'101',maximum:25,reserved:3},{academicYearId:'other',level:'SECTION',target:'A',maximum:1,reserved:0}]};
 assert.deepEqual(effectiveCapacity(policy,c,{id:'A',room:'101',capacity:30}),{maximum:25,reserved:3,capacity:22});
 assert.equal(effectiveCapacity({},c,{capacity:null}).capacity,null);
});
test('heterogeneous allocation preserves occupants and waitlists overflow deterministically',()=>{
 const students=Array.from({length:6},(_,i)=>({id:String(i),version:1}));
 const sections=[{id:'A',capacity:3,occupied:2},{id:'B',capacity:4,occupied:0}];
 const result=capacityAllocation(students,sections,{},'year');
 assert.equal(result.assignments.length,5);assert.equal(result.waitlist.length,1);
 assert.deepEqual(result.distribution.map(s=>s.proposedTotal),[3,4]);
 assert.deepEqual(result,capacityAllocation(students,sections,{},'year'));
 assert.deepEqual(sections.map(s=>s.occupied),[2,0]);
});
test('student restrictions and preferences are respected with most constrained first',()=>{
 const policy={constraints:[{academicYearId:'year',enrollmentId:'restricted',allowedSectionIds:['A'],preferredSectionIds:[]},{academicYearId:'year',enrollmentId:'preferred',allowedSectionIds:['A','B'],preferredSectionIds:['B']}]};
 const r=capacityAllocation([{id:'unrestricted',version:1},{id:'preferred',version:1},{id:'restricted',version:1}],[{id:'A',capacity:1,occupied:0},{id:'B',capacity:2,occupied:0}],policy,'year');
 assert.equal(r.assignments.find(a=>a.enrollmentId==='restricted').sectionId,'A');assert.equal(r.assignments.find(a=>a.enrollmentId==='preferred').sectionId,'B');assert.equal(r.waitlist.length,0);
});
test('invalid capacities, duplicate scopes and over-reservation fail closed',()=>{
 assert.throws(()=>capacityAllocation([],[{id:'A',capacity:1,occupied:2}],{},'year'),/Configure/);
 const rule={academicYearId:'year',level:'GRADE',target:'grade',maximum:10,reserved:10};assert.equal(capacityPolicySchema.safeParse({rules:[rule]}).success,false);
 rule.reserved=0;assert.equal(capacityPolicySchema.safeParse({rules:[rule,rule]}).success,false);
});
test('utilization preference balances heterogeneous section ratios',()=>{
 const r=capacityAllocation([{id:'x',version:1}],[{id:'A',capacity:10,occupied:3},{id:'B',capacity:30,occupied:4}],{preference:'BALANCED_UTILIZATION'},'year');assert.equal(r.assignments[0].sectionId,'B');
});

test('augmenting paths avoid a false waitlist while preserving existing placements',()=>{
 const policy={constraints:[{academicYearId:'year',enrollmentId:'one',allowedSectionIds:['A','B']},{academicYearId:'year',enrollmentId:'two',allowedSectionIds:['A','C']},{academicYearId:'year',enrollmentId:'three',allowedSectionIds:['A','C']}]};
 const r=capacityAllocation(['one','two','three'].map(id=>({id,version:1})),['A','B','C'].map(id=>({id,capacity:1,occupied:0})),policy,'year');
 assert.equal(r.waitlist.length,0);assert.equal(new Set(r.assignments.map(a=>a.sectionId)).size,3);
});

const {sectionProposal}=require('../dist/student-admissions/capacity-rules');
test('76 uploaded students generate three sections from a saved group norm of 30',()=>{
 const schoolClass={id:'grade',academicGroup:'PRIMARY',academicYearId:'year',sections:[]};
 const policy={rules:[{academicYearId:'year',level:'ACADEMIC_LEVEL',target:'PRIMARY',maximum:30,reserved:0}]};
 const sections=sectionProposal(schoolClass,policy,76);
 assert.deepEqual(sections.map(s=>s.name),['A','B','C']);assert.deepEqual(sections.map(s=>s.capacity),[30,30,30]);
 const result=capacityAllocation(Array.from({length:76},(_,i)=>({id:String(i),version:1})),sections.map(s=>({id:s.key,capacity:s.usable,occupied:0})),policy,'year');
 assert.deepEqual(result.distribution.map(s=>s.proposedTotal),[26,25,25]);
 assert.equal(schoolClass.sections.length,0);
 assert.throws(()=>sectionProposal(schoolClass,{},76),/maximum students per section/);
});
test('section proposal subtracts existing heterogeneous seats and honors reservations',()=>{
 const c={id:'grade',academicGroup:'PRIMARY',academicYearId:'year',sections:[{id:'A',name:'A',capacity:20,status:'ACTIVE',updatedAt:new Date('2026-01-01')}]};
 const policy={rules:[{academicYearId:'year',level:'ACADEMIC_LEVEL',target:'PRIMARY',maximum:30,reserved:2}]};
 const sections=sectionProposal(c,policy,45,{A:15});assert.equal(sections.length,2);assert.equal(sections[0].usable,18);assert.equal(sections[1].usable,28);assert.equal(sections[0].occupied,15);
});
