require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup:render}=require('react-dom/server');
const {PrismaClient}=require('@prisma/client');
const {timetableLoader}=require('./helpers/timetable-ui-loader');

test('read-only current Kidzee Play School, Nursery, LKG and UKG data renders missing, draft and published timetable states',{skip:process.env.TIMETABLE_LIVE_TEST!=='1',timeout:60000},async()=>{
 const db=new PrismaClient();
 try {
  const schools=await db.school.findMany({where:{name:{equals:'kidzee',mode:'insensitive'}},select:{id:true,name:true}});assert.equal(schools.length,1,'Expected one explicitly scoped Kidzee school');
  const school=schools[0],year=await db.academicYear.findFirst({where:{schoolId:school.id,isCurrent:true}});assert.ok(year);
  const {ClassWorkspaceService}=require('../../backend/dist/class-workspace/class-workspace.service');
  const {TimetablePlanningService}=require('../../backend/dist/timetable/timetable-planning.service');
  const {TimetableRulesService}=require('../../backend/dist/timetable/timetable-rules.service');
  const rules=new TimetableRulesService(db);
  const classes=(await new ClassWorkspaceService(db).workspaces(school.id,year.id)).filter(c=>['Play School','Nursery','LKG','UKG'].includes(c.name));
  assert.equal(classes.length,4);
  const service=new TimetablePlanningService(db,rules),plans=await service.plans(school.id,{academicYearId:year.id});
  const loader=timetableLoader();const {latestSectionPlans}=loader.load('lib/timetable-overview.ts'),latest=latestSectionPlans(plans);
  const {TimetableMatrix}=loader.load('components/timetable-matrix.tsx'),{TimetablePlanner}=loader.load('components/timetable-planner.tsx'),{TimetableNavigator}=loader.load('components/timetable-navigator.tsx');
  const before=plans.map(p=>[p.id,p.status,p.version,String(p.generatedAt)]).sort();
  const states=new Set(),slotCounts=new Set();let sectionCount=0;
  for(const c of classes)for(const section of c.sections){
   sectionCount++;const p=latest.get(section.id);states.add(p?.status||'MISSING');
   const markup=render(React.createElement(TimetablePlanner,{yearId:year.id,classId:c.id,sectionId:section.id,sectionLabel:c.name+' / Section '+section.name,subjects:[],providedPlans:plans.filter(p=>p.sectionId===section.id)}));
   assert.equal((markup.match(/<table class="tt-matrix"/g)||[]).length,p?1:0);
   if(!p){assert.match(markup,/No timetable for this section/);continue;}
   const matrix=render(React.createElement(TimetableMatrix,{plan:p}));slotCounts.add(p.template.slots.length);
   assert.equal((matrix.slice(matrix.indexOf('<thead>'),matrix.indexOf('</thead>')).match(/<th scope="col"/g)||[]).length,p.template.slots.length+1);
   assert.equal((matrix.slice(matrix.indexOf('<tbody>')).match(/<tr>/g)||[]).length,p.template.workingDays.length);
   for(const slot of p.template.slots){assert.ok(matrix.includes(slot.startTime));assert.ok(matrix.includes(slot.endTime));}
   if(p.template.workingDays.includes(7))assert.match(matrix,/>Sun</);
  }
  assert.ok(states.has('DRAFT')&&states.has('PUBLISHED')&&states.has('MISSING'));assert.ok(slotCounts.size>=3);
  const draft=plans.find(p=>p.status==='DRAFT');const checked=await rules.validatePlan(school.id,draft.id);assert.equal(typeof checked.valid,'boolean');
  const nav=render(React.createElement(TimetableNavigator,{classes,latest,conflicts:{},checks:{[draft.id]:checked},selectedId:draft.sectionId,onSelect(){},disabled:false}));
  assert.equal((nav.match(/class="tt-nav-section /g)||[]).length,sectionCount);assert.match(nav,/Missing/);assert.match(nav,/Draft/);assert.match(nav,/Published/);
  const after=await service.plans(school.id,{academicYearId:year.id});assert.deepEqual(after.map(p=>[p.id,p.status,p.version,String(p.generatedAt)]).sort(),before,'Live timetable versions must remain unchanged');
  console.log(`Read-only validation: ${classes.length} classes, ${sectionCount} sections, ${[...slotCounts].join('/')} configured period counts, all three states verified.`);
 } finally {await db.$disconnect();}
});
