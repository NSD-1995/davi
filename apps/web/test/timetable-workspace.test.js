const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup:render}=require('react-dom/server');
const {timetableLoader}=require('./helpers/timetable-ui-loader');
const loader=timetableLoader();const logic=loader.load('lib/timetable-presentation.ts');
const {TimetableMatrix}=loader.load('components/timetable-matrix.tsx');
const {TimetableNavigator}=loader.load('components/timetable-navigator.tsx');
const slots=[{id:'assembly',name:'Assembly',type:'ASSEMBLY',sequence:1,startTime:'08:45',endTime:'09:00',applicableDays:[1,7]},{id:'p1',name:'Period 1',type:'TEACHING',sequence:2,startTime:'09:00',endTime:'09:40',applicableDays:[1,7]},{id:'break',name:'Snack break',type:'BREAK',sequence:3,startTime:'09:40',endTime:'10:00',applicableDays:[1]},{id:'p2',name:'Period 2',type:'SUBJECT',sequence:4,startTime:'10:00',endTime:'10:40',applicableDays:[7]}];
const plan={id:'draft',sectionId:'ps-1',classId:'ps',status:'DRAFT',version:2,generatedAt:'2026-10-25T01:00:00Z',template:{workingDays:[1,7],slots},entries:[{id:'e1',weekday:1,periodSlotId:'p1',teacherId:'t1',subject:{name:'Language & Storytelling'},teacher:{user:{firstName:'Anita',lastName:'Devi'}},room:'Blue'}],supervisionEntries:[{weekday:7,periodSlotId:'assembly',teacher:{user:{firstName:'Ravi',lastName:'Kumar'}}}]};
const classes=[{id:'ps',name:'Play School',sectionCount:2,sections:[{id:'ps-1',name:'1'},{id:'ps-a',name:'A'}]},{id:'nursery',name:'Nursery',sectionCount:1,sections:[{id:'n-1',name:'1'}]},{id:'lkg',name:'LKG',sectionCount:1,sections:[{id:'l-1',name:'1'}]},{id:'ukg',name:'UKG',sectionCount:1,sections:[{id:'u-1',name:'1'}]}];
const plans=[plan,{...plan,id:'published-old',status:'PUBLISHED',version:1,generatedAt:'2026-10-24T01:00:00Z'},{...plan,id:'nursery-plan',sectionId:'n-1',classId:'nursery',status:'PUBLISHED'}];
const html=(Component,props)=>render(React.createElement(Component,props));
test('matrix follows configured Sunday and varying periods, without adding Saturday',()=>{
 const result=html(TimetableMatrix,{plan});assert.match(result,/>Sun</);assert.match(result,/>Mon</);assert.doesNotMatch(result,/>Sat</);assert.match(result,/08:45–09:00/);assert.match(result,/Language &amp; Storytelling/);assert.match(result,/Anita Devi/);assert.match(result,/Ravi Kumar/);assert.match(result,/tt-cell-assembly/);assert.match(result,/tt-cell-break/);assert.match(result,/Not scheduled/);
});
test('applicable-day rules distinguish unscheduled periods from free teaching slots',()=>{
 assert.equal(logic.timetableCell(plan,slots[3],1).kind,'inactive');assert.equal(logic.timetableCell(plan,slots[3],7).subject,'Flexible / free');
 assert.equal(logic.timetableCell(plan,slots[1],1).room,'Blue');assert.deepEqual(logic.timetableDays({...plan,template:{...plan.template,workingDays:[7]}}),[7]);
});
test('missing teacher and period-template states are explicit',()=>{
 assert.equal(logic.timetableCell({...plan,entries:[{weekday:1,periodSlotId:'p1',subject:{name:'Maths'}}]},slots[1],1).teacher,'Teacher not assigned');
 assert.match(html(TimetableMatrix,{plan:{...plan,template:null}}),/Period template unavailable/);
});
test('matrix retains configured order, sticky-compatible headers and validated conflict locations',()=>{
 const result=html(TimetableMatrix,{plan:{...plan,template:{...plan.template,slots:[...slots].reverse()}},issues:[{weekday:1,periodSlotId:'p1'}]});assert.ok(result.indexOf('Assembly')<result.indexOf('Period 1'));assert.match(result,/scope="row" class="tt-day-label"/);assert.match(result,/role="region"/);assert.match(result,/tt-cell-conflict/);
});
test('navigator includes missing, draft and published sections without timetable matrices',()=>{
 const latest=loader.load('lib/timetable-overview.ts').latestSectionPlans(plans);const result=html(TimetableNavigator,{classes,latest,conflicts:{draft:[{code:'TEACHER_CONFLICT',message:'Overlap'}]},checks:{},selectedId:'ps-1',onSelect(){},disabled:false});
 for(const name of ['Play School','Nursery','LKG','UKG'])assert.match(result,new RegExp(name));assert.match(result,/Missing/);assert.match(result,/Draft/);assert.match(result,/Published/);assert.match(result,/aria-current="page"/);assert.match(result,/1 detected issues/);assert.doesNotMatch(result,/tt-matrix/);
});
test('search and class/group filters preserve the exact scope for batch actions',()=>{
 assert.equal(logic.filterTimetableClasses(classes,'MONTESSORI','','').length,4);assert.deepEqual(logic.filterTimetableClasses(classes,'','ps','a').flatMap(c=>c.sections.map(s=>s.id)),['ps-1','ps-a']);assert.equal(logic.filterTimetableClasses(classes,'','','nursery 1')[0].id,'nursery');assert.equal(logic.filterTimetableClasses(classes,'PRIMARY','','').length,0);
});
test('CSV exports configured timings, nonteaching periods and neutralizes spreadsheet formulas',()=>{
 const csv=logic.timetableCSV([{label:'=unsafe',plan}]);assert.match(csv,/"'=unsafe"/);assert.match(csv,/08:45/);assert.match(csv,/Assembly/);assert.match(csv,/Not scheduled/);assert.match(csv,/Anita Devi/);assert.match(csv,/"Sun"/);
});
function renderPlanner(sectionPlans,options={}){
 let state=0;const react={...React,useState(initial){const index=state++;return React.useState(options.history&&index===9?true:options.daily&&index===4?'daily':initial);}};
 const local=timetableLoader({react,session:options.permissions?{...loader.session,permissions:options.permissions}:loader.session});return html(local.load('components/timetable-planner.tsx').TimetablePlanner,{yearId:'year',classId:'ps',sectionId:'ps-1',sectionLabel:'Play School / Section 1',subjects:[],providedPlans:sectionPlans,conflictEntries:options.issues||[]});
}
test('section planner renders one latest matrix and moves older versions into a closed drawer',()=>{
 const result=renderPlanner(plans.filter(p=>p.sectionId==='ps-1'));assert.equal((result.match(/<table class="tt-matrix"/g)||[]).length,1);assert.match(result,/Version 2/);assert.match(result,/Version history \(2\)/);assert.doesNotMatch(result,/>Version 1</);assert.match(result,/Regenerate/);assert.match(result,/Publish/);assert.match(result,/Not fully validated/);
});
test('version history lists metadata and preview actions without rendering older grids',()=>{
 const result=renderPlanner(plans.filter(p=>p.sectionId==='ps-1'),{history:true});assert.match(result,/Version history/);assert.match(result,/>Version 1</);assert.equal((result.match(/<table class="tt-matrix"/g)||[]).length,1);assert.match(result,/Preview latest/);
});
test('missing timetable uses a compact generation state instead of a blank grid',()=>{
 const result=renderPlanner([]);assert.match(result,/No timetable for this section/);assert.match(result,/Generate timetable/);assert.doesNotMatch(result,/<table/);
});
test('view-only roles cannot generate, publish or delete a timetable',()=>{
 const result=renderPlanner([plan],{permissions:['TIMETABLE_VIEW']});assert.doesNotMatch(result,/>Regenerate<|>Publish<|Delete this version/);assert.match(result,/>Validate</);
});
test('known validation errors block the section Publish button',()=>{
 const result=renderPlanner([plan],{issues:[{code:'TEACHER_CONFLICT',message:'Teacher overlaps',weekday:1,periodSlotId:'p1'}]});assert.match(result,/disabled="">Publish/);assert.match(result,/Teacher overlaps/);
});
test('Daily Cover uses a published predecessor rather than the latest draft',()=>{
 const result=renderPlanner(plans.filter(p=>p.sectionId==='ps-1'),{daily:true});assert.match(result,/Version 1/);assert.doesNotMatch(result,/Publish a timetable first|<table/);assert.match(result,/Uses the published timetable/);
 assert.match(renderPlanner([plan],{daily:true}),/Publish a timetable first/);
});
function renderPage({selectedId='ps-1',permissions=loader.session.permissions,search='',group='',classId=''}={}){
 let state=0;const session={...loader.session,permissions},key=JSON.stringify([session.token,session.permissions,'year']);
 const react={...React,useState(initial){const index=state++;return React.useState(index===0?{key,classes,plans}:index===1?group:index===2?classId:index===3?search:index===4?selectedId:index===7?false:initial);}};
 const local=timetableLoader({session,react});return html(local.load('app/(admin)/academics/timetables/page.tsx').default,{});
}
test('master-detail page mounts exactly one planner across Play School, Nursery, LKG and UKG',()=>{
 const result=renderPage();assert.equal((result.match(/class="tt-planner/g)||[]).length,1);assert.equal((result.match(/<table class="tt-matrix"/g)||[]).length,1);assert.match(result,/Play School \/ Section 1/);assert.match(result,/Select class and section/);assert.match(result,/Generate \(5\)/);assert.match(result,/Publish all filtered drafts \(1\)/);assert.match(result,/Delete ALL timetables in year/);
});
test('selecting a missing section does not retain another section timetable',()=>{
 const result=renderPage({selectedId:'u-1'});assert.match(result,/UKG \/ Section 1/);assert.match(result,/No timetable for this section/);assert.doesNotMatch(result,/<table class="tt-matrix"/);
});
test('page search restricts navigator and the displayed batch scope',()=>{
 const result=renderPage({search:'nursery'});assert.match(result,/Nursery \/ Section 1/);assert.match(result,/Generate \(1\)/);assert.doesNotMatch(result,/<h2>Play School \/ Section 1<\/h2>/);
});
test('page-level batch and destructive actions retain independent role permissions',()=>{
 const result=renderPage({permissions:['TIMETABLE_VIEW']});assert.doesNotMatch(result,/Generate \(|Publish all filtered|Delete ALL timetables/);assert.match(result,/Validate all filtered/);assert.match(result,/Save filtered as PDF/);
});

function captureUI({page=false,api={},exports={},confirm=true}={}){
 const calls=[];const jsx=require('react/jsx-runtime');let state=0;
 const session=loader.session,key=JSON.stringify([session.token,session.permissions,'year']);
 const react={...React,useState(initial){const index=state++;return React.useState(page?(index===0?{key,classes,plans}:index===7?false:initial):initial);}};
 const local=timetableLoader({react,api,exportApi:exports});
 // Capture the actual rendered button handlers while React still owns the hooks.
 const fs=require('fs'),path=require('path'),ts=require('typescript');
 const file=page?'app/(admin)/academics/timetables/page.tsx':'components/timetable-planner.tsx';
 const source=fs.readFileSync(path.join(__dirname,'../',file),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const component={};
 const base=file.startsWith('app/')?'../../../../':'../';
 const req=name=>{
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return {...jsx,jsx(type,props,key){if(type==='button')calls.push(props);return jsx.jsx(type,props,key);},jsxs(type,props,key){if(type==='button')calls.push(props);return jsx.jsxs(type,props,key);}};
  if(name.endsWith('/api'))return {ApiError:class extends Error{},timetablePlanningApi:{},timetableRulesApi:{},classWorkspaceApi:{},operationsApi:{},...api};
  if(name.endsWith('/auth-context'))return {useAuth:()=>({session,can:p=>session.permissions.includes(p)})};
  if(name.endsWith('/academic-year-context'))return {useAcademicYear:()=>({selected:local.selected})};
  if(name.endsWith('/school-academic-groups-context'))return {useSchoolAcademicGroups:()=>({groups:[{id:'MONTESSORI',label:'Montessori'}]})};
  if(name.endsWith('/toast-context'))return {useToast:()=>({show(){}})};
  if(name.endsWith('/timetable-export'))return {printTimetableCollection(){},downloadTimetableCSV(){},...exports};
  if(name==='next/link')return {default:({children,...props})=>React.createElement('a',props,children)};
  if(name.startsWith('.'))return local.load(path.resolve(__dirname,'../',path.dirname(file),name));return require(name);
 };
 new Function('exports','require',compiled)(component,req);
 render(React.createElement(page?component.default:component.TimetablePlanner,page?{}:{yearId:'year',classId:'ps',sectionId:'ps-1',sectionLabel:'Play School / Section 1',subjects:[],providedPlans:plans.filter(p=>p.sectionId==='ps-1')}));
 const text=node=>Array.isArray(node)?node.map(text).join(''):typeof node==='string'||typeof node==='number'?String(node):node?.props?text(node.props.children):'';
 return {button:name=>calls.find(props=>text(props.children)===name),calls,text};
}
test('section Publish sends the displayed draft ID to the existing endpoint',async()=>{
 let sent;const ui=captureUI({api:{timetablePlanningApi:{publish:async(token,id)=>{sent={token,id};}}}});ui.button('Publish').onClick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(sent,{token:'test',id:'draft'});
});
test('batch Publish uses only latest filtered drafts, keeping atomic publication in one API call',async()=>{
 const sent=[];const ui=captureUI({page:true,api:{timetablePlanningApi:{publishAll:async(token,body)=>{sent.push(body);return {publishedPlans:1};},allPlans:async()=>plans}}});
 ui.button('Publish all filtered drafts (1)').onClick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(sent,[{academicYearId:'year',planIds:['draft']}]);
});
test('Generate sends every scoped section to the existing batch generation endpoint',async()=>{
 let sent;const ui=captureUI({page:true,api:{timetableRulesApi:{generate:async(token,body)=>{sent=body;return {success:true};}},timetablePlanningApi:{allPlans:async()=>plans}}});ui.calls.find(props=>props.className==='button tt-generate-filtered').onClick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(sent.sectionIds,['ps-1','ps-a','n-1','l-1','u-1']);assert.equal(sent.academicYearId,'year');
});
test('destructive section and whole-year deletion both require explicit confirmation',async()=>{
 const previous=global.window;let removed=0;const prompts=[];global.window={confirm:message=>{prompts.push(message);return false;}};
 try{let ui=captureUI({api:{timetablePlanningApi:{remove:async()=>removed++}}});ui.button('Delete this version').onClick();ui=captureUI({page:true,api:{timetablePlanningApi:{removeAll:async()=>removed++}}});ui.calls.find(props=>ui.text(props.children).startsWith('Delete ALL')).onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(removed,0);assert.equal(prompts.length,2);assert.match(prompts[1],/ALL academic groups/);}finally{global.window=previous;}
});
test('PDF and filtered CSV actions export the intended versions and no historical extras',()=>{
 const prints=[],csv=[];let ui=captureUI({exports:{printTimetableCollection:sections=>prints.push(sections)}});ui.button('Download PDF').onClick();assert.deepEqual(prints[0].map(s=>s.plan.id),['draft']);
 ui=captureUI({page:true,exports:{downloadTimetableCSV:sections=>csv.push(sections)}});ui.button('Download filtered CSV').onClick();assert.deepEqual(csv[0].map(s=>s.plan.id),['draft','nursery-plan']);
});
