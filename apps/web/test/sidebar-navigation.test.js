const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const cache={};
function load(name){if(cache[name])return cache[name];const out={};cache[name]=out;new Function('exports','require',ts.transpileModule(fs.readFileSync(`apps/web/lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(out,n=>n.startsWith('./')?load(n.slice(2)):require(n));return out;}
const {schoolSidebar,visibleSidebar,sidebarLinkActive,sidebarDestination,sidebarIcons,reportIcons}=load('sidebar-navigation');
const can=permissions=>p=>!p||permissions.includes(p);
const all=()=>true;
test('separate modules and direct destinations have unique implemented destinations and one allocation link',()=>{
 assert.deepEqual(schoolSidebar.map(g=>g.label),['Dashboard','School Configuration','Admissions','Students','Class Workspace','Academics','Daily Operations','Staff Management','Automation & Jobs','Communication','Reports & Analytics','Administration']);
 const links=visibleSidebar(all).flatMap(g=>g.links);assert.equal(new Set(links.map(l=>l.href)).size,links.length);assert.equal(links.filter(l=>l.label==='Section Allocation').length,1);
 for(const link of links){const route=link.href.split('?')[0];assert.ok(fs.existsSync(path.join('apps/web/app/(admin)',route,'page.tsx'))||route.startsWith('/admissions/'),route);}
});
test('read-only student directory keeps unassigned roster discoverable without allocation permission',()=>{
 const source=fs.readFileSync('apps/web/app/(admin)/people/students/page.tsx','utf8');
 assert.match(source,/href="\/students\/unassigned">Unassigned Students/);
 const links=visibleSidebar(can(['STUDENT_VIEW'])).flatMap(g=>g.links);
 assert.ok(links.some(l=>l.href==='/people/students'));assert.ok(!links.some(l=>l.href==='/students/allocation'));
});
test('School Admin permission set exposes all modules; Principal is permission-driven',()=>{
 assert.equal(visibleSidebar(all,'',true).length,12);
 const principal=visibleSidebar(can(['CLASS_VIEW','STAFF_VIEW','REPORT_VIEW','MARKS_VIEW','ATTENDANCE_VIEW','COMMUNICATION_VIEW','ASSESSMENT_CONFIGURE']));
 assert.ok(principal.some(g=>g.id==='reports'));assert.ok(principal.flatMap(g=>g.links).some(l=>l.label==='Teaching Assignments'));assert.ok(!principal.flatMap(g=>g.links).some(l=>l.href==='/access/roles'||l.href==='/admissions/settings'));
});
test('Teacher, admissions clerk and no-permission profiles do not inherit unrelated menus',()=>{
 const teacher=visibleSidebar(can(['CLASS_VIEW','LESSON_PLAN_VIEW','TIMETABLE_VIEW','HOMEWORK_VIEW']));assert.ok(teacher.some(g=>g.id==='academics'));assert.ok(!teacher.some(g=>['administration','operations','reports'].includes(g.id)));
 const clerk=visibleSidebar(can(['ADMISSIONS_VIEW','ADMISSIONS_MANAGE','STUDENT_VIEW']));assert.ok(clerk.flatMap(g=>g.links).some(l=>l.label==='Enquiries & Follow-ups'));assert.ok(!clerk.flatMap(g=>g.links).some(l=>l.label==='Admission Settings'||l.label==='Section Allocation'||l.label==='Student Imports'));
 assert.deepEqual(visibleSidebar(can([])).map(g=>g.id),['dashboard']);
});
test('seeded Montessori Teacher permissions expose daily teaching without administrative controls',()=>{
 const source=fs.readFileSync('apps/backend/scripts/seed-montessori-roles.js','utf8');
 const block=source.match(/const defaultPermissionCodes = \[([\s\S]*?)\];/)[1];
 const permissions=[...block.matchAll(/'([^']+)'/g)].map(m=>m[1]);
 const links=visibleSidebar(can(permissions)).flatMap(g=>g.links).map(l=>l.label);
 for(const label of ['Class Workspace','Timetables','Student Directory','Academic Planner','Announcements','Holidays & Events'])assert.ok(links.includes(label),label);
 for(const label of ['Roles & Permissions','Staff Directory','Assessment Settings','Attendance Settings','Admission Settings','Student Imports'])assert.ok(!links.includes(label),label);
});
test('substitution legacy permission alternative and admission/student prerequisites stay intact',()=>{
 const has=ps=>visibleSidebar(can(ps)).flatMap(g=>g.links).map(l=>l.label);
 assert.ok(has(['timetable.substitution.view']).includes('Substitution Planner'));assert.ok(has(['ATTENDANCE_VIEW','STAFF_VIEW']).includes('Substitution Planner'));assert.ok(!has(['STAFF_VIEW']).includes('Substitution Planner'));
 assert.ok(!has(['ENROLLMENT_ALLOCATE']).includes('Section Allocation'));assert.ok(has(['STUDENT_VIEW','ENROLLMENT_ALLOCATE']).includes('Section Allocation'));
 assert.ok(!has(['ADMISSIONS_SETTINGS_MANAGE']).includes('Admission Settings'));assert.ok(!has(['students.import.view']).includes('Student Imports'));
});
test('deep links, allocation aliases, follow-ups and legacy analytics select exactly one leaf',()=>{
 for(const [route,query,label]of [['/academics/workspace/c/sections/s','','Class Workspace'],['/people/teachers/t','','Teaching Assignments'],['/operations/attendance','','Staff Attendance'],['/academics/section-capacity','','Section Allocation'],['/admissions/follow-ups','','Enquiries & Follow-ups'],['/reports/analytics','view=subjects','Academic Performance'],['/reports/analytics','view=attendance','Engagement Analytics'],['/reports/analytics','view=students','Class & Section Analytics']]){
  const selected=visibleSidebar(all).flatMap(g=>g.links).filter(l=>sidebarLinkActive(l,route,query));assert.equal(selected.length,1,route);assert.equal(selected[0].label,label);assert.equal(sidebarDestination(route,query).link.label,label);
 }
 assert.equal(sidebarLinkActive({href:'/academics/workspace',label:'',permission:''},'/academics/workspace-other'),false);
});
test('search filters only accessible links, including route aliases and group names',()=>{
 assert.equal(visibleSidebar(can([]),'roles').length,0);assert.equal(visibleSidebar(all,'follow-ups')[0].links[0].href,'/admissions/enquiries');assert.equal(visibleSidebar(all,'/academics/section-capacity')[0].links[0].href,'/students/allocation');assert.ok(visibleSidebar(all,'School Configuration')[0].links.length===8);
});
function renderSidebar({route='/academics/workspace/c/sections/s',query='',permissions=null,search='',desktop=false,compact=false,expanded={}}={}){
 let i=0;const states=[desktop,expanded],out={};new Function('exports','require',ts.transpileModule(fs.readFileSync('apps/web/components/sidebar-navigation.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(out,n=>{
  if(n==='react')return {...React,useEffect(){},useState:initial=>React.useState(i<states.length?states[i++]:initial)};
  if(n.endsWith('/school-navigation'))return {default:({children,...p})=>React.createElement('a',p,children),useSearchParams:()=>new URLSearchParams(query)};
  if(n.endsWith('/auth-context'))return {useAuth:()=>({can:permissions?can(permissions):all,session:{roles:[{code:permissions?'TEACHER':'SCHOOL_ADMIN'}]}})};
  if(n.endsWith('/sidebar-navigation'))return load('sidebar-navigation');return require(n);
 });return renderToStaticMarkup(React.createElement(out.SidebarNavigation,{path:route,compact,onNavigate(){}}));
}
test('nested academic route expands only academics, while workspace and dashboard are direct links',()=>{
 const html=renderSidebar({route:'/academics/academic-planner'});assert.equal((html.match(/aria-expanded="true"/g)||[]).length,1);assert.match(html,/aria-controls="school-nav-academics"/);assert.match(html,/href="\/academics\/academic-planner"[^>]*aria-current="page"/);
 for(const route of ['/dashboard','/academics/workspace/c/sections/s','/operations']){const direct=renderSidebar({route});assert.equal((direct.match(/aria-expanded="true"/g)||[]).length,0);assert.equal((direct.match(/aria-current="page"/g)||[]).length,1);}
 assert.equal((renderSidebar({route:'/dashboard'}).match(/href="\/dashboard"/g)||[]).length,1);
});
test('search is absent and compact desktop keeps distinct links while mobile uses collapsed groups',()=>{
 const html=renderSidebar();assert.doesNotMatch(html,/Find a page|Search navigation|type="search"/);
 const rail=renderSidebar({compact:true,desktop:true});assert.equal((rail.match(/aria-expanded="true"/g)||[]).length,9);assert.equal((rail.match(/href="\/students\/allocation"/g)||[]).length,1);
 assert.equal((renderSidebar({route:'/academics/academic-planner',compact:true,desktop:false}).match(/aria-expanded="true"/g)||[]).length,1);
});
test('every navigation destination has a unique module icon and admissions is separate from students',()=>{
 const leaves=visibleSidebar(all,'',true).flatMap(g=>g.links);assert.ok(leaves.every(l=>l.icon));assert.equal(new Set(leaves.map(l=>l.icon)).size,leaves.length);
 assert.ok(schoolSidebar.find(g=>g.id==='admissions').links.every(l=>l.href.startsWith('/admissions/')));assert.ok(schoolSidebar.find(g=>g.id==='students').links.every(l=>!l.href.startsWith('/admissions/')));
 assert.deepEqual(schoolSidebar.filter(g=>g.direct).map(g=>g.label),['Dashboard','Class Workspace','Daily Operations']);
});
test('breadcrumbs use current grouping, names and report query mappings',()=>{
 const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync('apps/web/components/academic-breadcrumbs.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(out,n=>{
  if(n.endsWith('/school-navigation'))return {default:({children,...p})=>React.createElement('a',p,children),usePathname:()=>'/operations/attendance-settings',useSearchParams:()=>new URLSearchParams()};if(n.endsWith('/sidebar-navigation'))return load('sidebar-navigation');return require(n);
 });const html=renderToStaticMarkup(React.createElement(out.AcademicBreadcrumbs));assert.match(html,/School Configuration/);assert.match(html,/aria-current="page">Attendance Settings/);
});
