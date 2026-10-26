const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks={}) {
 const source=fs.readFileSync(path.join(__dirname,'../',file),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};new Function('exports','require',js)(exports,name=>name in mocks?mocks[name]:require(name));return exports;
}
const logic=load('lib/workspace-list.ts');
const section={id:'section-a',name:'A',studentCount:12,capacity:20,room:'Blue',status:'ACTIVE',classTeacher:true,classTeacherDetails:{id:'teacher-1',firstName:'Anita',lastName:'Devi',teacherCode:'T01'},subjectTeacherCount:2,todayAttendance:{present:0,absent:0,late:0,notMarked:12}};
const parent={id:'class-1',name:'Nursery',code:'NUR',sectionCount:2,studentCount:25,unassignedStudentCount:1,sections:[section,{...section,id:'section-2',name:'2',studentCount:12,classTeacherDetails:null,capacity:null}]};
function render(rows=[parent],{query='',view='cards',collapsed=false,permissions=[]}={}) {
 const mockedReact={...React,useState(initial){return React.useState(initial===''?query:initial==='cards'?view:initial instanceof Set&&collapsed?new Set(rows.map(r=>r.id)):initial);}};
 const component=load('components/workspace-class-list.tsx',{
  react:mockedReact,'../lib/workspace-list':logic,'../lib/auth-context':{useAuth:()=>({can:p=>permissions.includes(p)})},
  'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
  './ui':{StatusBadge:({status})=>React.createElement('span',null,status)},
 });
 return renderToStaticMarkup(React.createElement(component.WorkspaceClassList,{rows,yearId:'year-2026'}));
}
test('class headings appear once and every section has the correct year-aware destination',()=>{
 const result=render();assert.equal((result.match(/>Nursery<\/span>/g)||[]).length,1);assert.match(result,/2 sections/);assert.match(result,/25 students/);assert.match(result,/Section A/);assert.match(result,/Section 2/);
 assert.match(result,/href="\/academics\/workspace\/class-1\/sections\/section-a\?year=year-2026"/);assert.match(result,/href="\/academics\/workspace\/class-1\/sections\/section-2\?year=year-2026"/);assert.match(result,/Open workspace for Nursery, section A/);
});
test('no attendance records produce Not marked and never a fabricated absence count',()=>{
 const result=render();assert.match(result,/Not marked/);assert.match(result,/No attendance recorded today/);assert.doesNotMatch(result,/0 absent|12 absent/);
 assert.equal(logic.workspaceAttendance(section).recorded,0);
});
test('partial, complete, all-absent and empty-section attendance remain distinct',()=>{
 assert.equal(logic.workspaceAttendance({...section,todayAttendance:{present:5,absent:1,late:0,notMarked:6}}).label,'Partially marked');
 assert.equal(logic.workspaceAttendance({...section,todayAttendance:{present:0,absent:12,late:0,notMarked:0}}).label,'Marked');
 assert.equal(logic.workspaceAttendance({...section,studentCount:0,todayAttendance:{present:0,absent:0,late:0,notMarked:0}}).label,'No students');
 assert.equal(logic.workspaceAttendance({...section,todayAttendance:undefined}).label,'Not marked');
 const result=render([{...parent,sections:[{...section,todayAttendance:{present:5,absent:1,late:1,notMarked:5}}]}]);assert.match(result,/7 of 12 recorded/);assert.match(result,/5 present/);assert.match(result,/1 absent/);assert.match(result,/1 late/);
});
test('search spans class, section, full teacher name and existing codes without changing class totals',()=>{
 for(const query of ['nursery','NUR','anita devi','T01','nursery a','Blue'])assert.equal(logic.filterWorkspaceClasses([parent],query).length,1,query);
 const filtered=logic.filterWorkspaceClasses([parent],'section-that-does-not-exist');assert.equal(filtered.length,0);
 const matched=logic.filterWorkspaceClasses([parent],'anita');assert.equal(matched[0].sections.length,1);assert.equal(matched[0].sectionCount,2);assert.equal(matched[0].studentCount,25);assert.equal(parent.sections.length,2);
 const result=render([parent],{query:'anita'});assert.match(result,/1 shown/);assert.match(result,/25 students/);assert.doesNotMatch(result,/Section 2/);
});
test('missing teacher and missing capacity are explicit, while zero capacity is preserved',()=>{
 let result=render();assert.match(result,/Not assigned/);assert.match(result,/capacity not set/);
 result=render([{...parent,sections:[{...section,capacity:0}]}]);assert.match(result,/0 seats/);
});
test('teacher links retain STAFF_VIEW permission and workspace actions remain available',()=>{
 const readOnly=render();assert.doesNotMatch(readOnly,/href="\/people\/teachers/);assert.match(readOnly,/Anita Devi/);assert.match(readOnly,/Open Workspace/);
 assert.match(render([parent],{permissions:['STAFF_VIEW']}),/href="\/people\/teachers\/teacher-1"/);
});
test('table mode groups by class instead of repeating a class column on every row',()=>{
 const result=render([parent],{view:'table'});assert.match(result,/aria-label="Nursery sections" tabindex="0"/);assert.match(result,/Students \/ capacity/);assert.match(result,/Today’s attendance/);assert.match(result,/aria-pressed="true"[^>]*>.*?Table/s);assert.doesNotMatch(result,/workspace-section-card/);
});
test('class groups expose keyboard collapse state and search reveals matching collapsed groups',()=>{
 let result=render([parent],{collapsed:true});assert.match(result,/aria-expanded="false" aria-controls=/);assert.match(result,/<div id="[^"]+" hidden=""/);
 result=render([parent],{collapsed:true,query:'anita'});assert.match(result,/aria-expanded="true"/);assert.doesNotMatch(result,/<div id="[^"]+" hidden=""/);
});
test('classes without sections retain the permission-gated management link',()=>{
 const empty={...parent,sections:[],sectionCount:0,studentCount:0};assert.match(render([empty]),/No sections yet/);assert.doesNotMatch(render([empty]),/>Manage class</);
 assert.match(render([empty],{permissions:['CLASS_VIEW']}),/href="\/academics\/classes"/);assert.equal(logic.filterWorkspaceClasses([empty],'nursery').length,1);
});
test('unmatched searches provide a clear reset action',()=>{const result=render([parent],{query:'unknown'});assert.match(result,/No matching classes or sections/);assert.match(result,/Clear search/);});
test('workspace links safely encode variable identifiers and retain the year parameter',()=>{assert.equal(logic.sectionWorkspaceHref('class /1','section #2','year &1'),'/academics/workspace/class%20%2F1/sections/section%20%232?year=year+%261');});

function renderPage({selected={id:'year-2026',name:'2026–2027'},result={key:JSON.stringify(['token','year-2026']),rows:[parent],loading:false,error:''}}={}) {
 const mockedReact={...React,useState(initial){return React.useState(initial&&typeof initial==='object'&&'loading' in initial?result:initial);}};
 const component=load('app/(admin)/academics/workspace/page.tsx',{
  react:mockedReact,'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
  '../../../../components/workspace-loading':{WorkspaceLoading:()=>React.createElement('p',{role:'status'},'Loading workspace')},
  '../../../../components/workspace-class-list':{WorkspaceClassList:({rows,yearId})=>React.createElement('p',null,'Directory '+yearId+' '+rows.map(r=>r.name).join(','))},
  '../../../../lib/api':{ApiError:class extends Error{},classWorkspaceApi:{}},
  '../../../../lib/academic-year-context':{useAcademicYear:()=>({selected})},
  '../../../../lib/auth-context':{useAuth:()=>({session:{token:'token'},can:p=>p==='STUDENT_VIEW'})},
  '../../../../components/ui':{
   PageHeader:({title,description})=>React.createElement('header',null,title,description),
   EmptyState:({title,detail})=>React.createElement('p',null,title,detail),
   ErrorState:({message,retry})=>React.createElement('div',null,message,React.createElement('button',{onClick:retry},'Try again')),
  },
 });
 return renderToStaticMarkup(React.createElement(component.default));
}
test('page preserves selected academic year and unassigned-student navigation',()=>{
 const result=renderPage();assert.match(result,/Directory year-2026 Nursery/);assert.match(result,/href="\/students\/unassigned"/);assert.match(result,/2026–2027/);
});
test('switching years immediately hides stale class data behind loading state',()=>{
 const result=renderPage({selected:{id:'another-year',name:'2027–2028'}});assert.match(result,/Loading workspace/);assert.doesNotMatch(result,/Nursery|View unassigned students/);
});
test('missing academic year and empty classes have separate states',()=>{
 assert.match(renderPage({selected:null}),/No academic year selected/);
 assert.match(renderPage({result:{key:JSON.stringify(['token','year-2026']),rows:[],loading:false,error:''}}),/No classes yet/);
});
test('load errors expose retry rather than an empty directory',()=>{
 const result=renderPage({result:{key:JSON.stringify(['token','year-2026']),rows:[],loading:false,error:'Unable to connect'}});assert.match(result,/Unable to connect/);assert.match(result,/Try again/);assert.doesNotMatch(result,/No classes yet/);
});
