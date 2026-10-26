const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
function load(file, mocks = {}) {
 const source = fs.readFileSync(path.join(__dirname, '../', file), 'utf8');
 const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports = {};
 new Function('exports','require',js)(exports, name => name in mocks ? mocks[name] : require(name));
 return exports;
}
const navigation=load('lib/analytics-navigation.ts');
const components=load('components/report-components.tsx',{'../lib/analytics-navigation':navigation});
const filters=load('components/report-filters.tsx',{'./report-components':components,'./ui':{Field:({label,children})=>React.createElement('label',null,label,children)}});
const charts=load('components/report-charts.tsx',{'./report-components':components});
const overview=load('components/report-overview.tsx',{'./report-components':components,'../lib/analytics-navigation':navigation});
const simpleUi={Field:({label,children})=>React.createElement('label',null,label,children),ErrorState:({message})=>React.createElement('p',null,message)};
const exportsModule=load('components/report-export-menu.tsx',{'../lib/api':{},'./ui':simpleUi,'./report-components':components});
const attentionModule=load('components/report-attention-case.tsx',{'./ui':simpleUi,'./report-components':components});
const html=(Component,props)=>render(React.createElement(Component,props));
test('six primary pages contain every distinct legacy dataset exactly once',()=>{
 assert.deepEqual(navigation.reportPages.map(p=>p.key),['overview','classes','academic','engagement','attention','operations']);
 const leaves=navigation.reportPages.flatMap(p=>p.views);assert.equal(new Set(leaves).size,leaves.length);
 assert.deepEqual(leaves.slice().sort(),['overview','classes','academic','exams','subjects','attendance','homework','attention','teachers','admissions','syllabus'].sort());
});
test('all legacy links retain their report, while utilities leave primary navigation',()=>{
 for(const leaf of ['academic','exams','subjects','attendance','homework','teachers','admissions','syllabus','students','overview','classes','attention']){
  const q=navigation.reportHref(leaf);const result=navigation.reportLocation(q.get('view'),q.get('subview'));assert.equal(result.leaf,leaf);
 }
 assert.equal(navigation.reportLocation('exports').utility,'exports');assert.equal(navigation.reportLocation('insights').utility,'insights');assert.equal(navigation.reportLocation('not-a-report').leaf,'unavailable');
});
test('role-based primary navigation and internal subviews preserve independent permissions',()=>{
 const can=p=>['REPORT_VIEW','HOMEWORK_VIEW','LESSON_PLAN_VIEW'].includes(p);
 const pages=navigation.permittedReportPages(can);assert.deepEqual(pages.map(p=>p.key),['overview','classes','engagement','operations']);
 assert.deepEqual(pages.find(p=>p.key==='engagement').views,['homework']);assert.deepEqual(navigation.permittedReportPages(()=>false),[]);
 assert.deepEqual(navigation.permittedReportPages(()=>true,true).find(p=>p.key==='operations').views,['syllabus']);
});
test('canonical navigation retains selected filters and does not carry export utility state',()=>{
 const q=navigation.reportHref('homework',new URLSearchParams('view=exams&academicYearId=y&classId=c&utility=exports'));
 assert.equal(q.get('view'),'engagement');assert.equal(q.get('subview'),'homework');assert.equal(q.get('academicYearId'),'y');assert.equal(q.get('classId'),'c');assert.equal(q.has('utility'),false);
});
test('report cells show readable dates, percentages, zero and missing values with keyboard sortable headings',()=>{
 const result=html(components.ReportDataTable,{title:'Attendance',columns:['date','attendancePercent','status','late','remarks'],rows:[{date:'2026-10-25',attendancePercent:0,status:'NOT_MARKED',late:false,remarks:null}]});
 assert.match(result,/0%/);assert.match(result,/25 Oct 2026/);assert.match(result,/Not marked/);assert.match(result,/No/);assert.match(result,/Not recorded/);assert.match(result,/role="region" aria-label="Attendance" tabindex="0"/);assert.match(result,/aria-sort="none"/);assert.match(result,/Search Attendance/);
});
test('large datasets identify local search boundaries, paginate loaded rows and expose drill-down',()=>{
 const result=html(components.ReportDataTable,{title:'Students',columns:['name'],rows:Array.from({length:50},(_,i)=>({enrollmentId:String(i),name:'Student '+i})),serverTotal:120,onStudent(){},onDrilldown(){}});
 assert.match(result,/50 loaded rows of 120/);assert.match(result,/1–10 of 50/);assert.match(result,/Explore Student 0/);assert.doesNotMatch(result,/>Student 10</);
});
test('empty tables present an explicit data state without a misleading zero',()=>{
 const result=html(components.ReportDataTable,{title:'Results',columns:['average'],rows:[]});assert.match(result,/No recorded data/);assert.match(result,/Missing records are not treated as zero/);
});
test('homework mix counts excused separately and labels overdue as a subset',()=>{
 const report={summary:{homeworkCompleted:4,homeworkPending:6,homeworkOverdue:2,homeworkExcused:1},capabilities:{homework:true}};
 const result=html(charts.ReportCharts,{view:'homework',report});assert.match(result,/Pending \(includes overdue\)/);assert.match(result,/Overdue within pending/);assert.match(result,/>11</);assert.doesNotMatch(result,/NaN|Infinity/);
});
test('attendance chart preserves missing-day gaps and offers exact accessible daily values',()=>{
 const result=html(charts.TrendChart,{rows:[{date:'2026-10-01',percentage:100,missing:0},{date:'2026-10-02',percentage:null,missing:12},{date:'2026-10-03',percentage:0,missing:0}]});
 assert.match(result,/Gaps mean insufficient records/);assert.match(result,/Not recorded/);assert.match(result,/0%/);assert.match(result,/Daily values and missing records/);assert.doesNotMatch(result,/NaN|Infinity/);
});
test('AI drafts and approval remain explicit and distinct from approved export content',()=>{
 const insight={status:'DRAFT',canReview:true,insights:{caveat:'Review required',findings:[{evidenceKey:'homework',summary:'Two overdue records',recommendation:'Review with teacher'}]}};
 let result=html(components.InsightPanel,{insight,busy:false,onGenerate(){},onApprove(){}});assert.match(result,/Draft · educator review required/);assert.match(result,/Approve for report inclusion/);
 result=html(components.InsightPanel,{insight:{...insight,status:'APPROVED'},busy:false,onGenerate(){},onApprove(){}});assert.match(result,/Approved/);assert.doesNotMatch(result,/Approve for report inclusion/);
});
test('applied filters identify scope and default month without exposing IDs',()=>{
 const result=html(filters.AppliedFilters,{filters:{academicYearId:'secret-year',classId:'secret-class',sectionId:'secret-section'},years:[{id:'secret-year',name:'2026–2027'}],options:{classes:[{id:'secret-class',name:'Class 1',sections:[{id:'secret-section',name:'A'}]}]},onReset(){}});
 assert.match(result,/Class 1/);assert.match(result,/2026–2027/);assert.match(result,/Current month/);assert.doesNotMatch(result,/secret-/);
});
const session={token:'test-token',user:{id:'u',school:{id:'s'}},roles:[],permissions:navigation.analyticsViews.map(v=>v.permission).filter(p=>p!=='__UNAVAILABLE__')};
function fixture(){return {id:'snapshot-1',asOf:'2026-10-25T00:00:00Z',expiresAt:'2026-10-26T00:00:00Z',filters:{academicYearId:'year'},studentTotal:1,page:1,pages:1,summary:{students:1,classes:1,sections:1,attendancePercent:90,missingDays:1,homeworkCompleted:2,homeworkPending:1,homeworkOverdue:1,homeworkExcused:0,homeworkPercent:66.67,reviewBacklog:0,attentionStudents:1,examExpectedAttempts:1,examRecordedAttempts:1,examCompletionPercent:100,numericAttempts:1,teachers:1,lessonPlans:1,lessonPlanCoverage:50},capabilities:{attendance:true,homework:true,exams:true,staff:true,staffAttendance:true,lessons:true,admissions:true,attention:true,attentionManage:true,export:true,ai:true},period:{from:'2026-10-01',to:'2026-10-25',timeZone:'Asia/Kolkata'},students:[{enrollmentId:'e',name:'Test Student',signals:[],details:{}}],comparisons:[],academicGroups:[],attendanceTrend:[],staffAttendance:[],teachers:[],lessons:[],admissions:{applications:[],payments:[]},warnings:[],registry:[],unavailable:{},studentDetailTotals:{},tableTotals:{}};}
function renderWorkspace(leaf,permissions=session.permissions,utility){
 const selected={...session,permissions};const q=navigation.reportHref(leaf);q.set('academicYearId','year');if(utility)q.set('utility',utility);
 const report=fixture();report.requestKey=JSON.stringify(['s','u','test-token',permissions.slice().sort(),[]])+JSON.stringify({academicYearId:'year'});
 let index=0;const mockedReact={...React,useState(initial){const i=index++;return React.useState(i===6?report:i===10?false:initial);}};
 const ui={Field:({label,children})=>React.createElement('label',null,label,children),EmptyState:({title})=>React.createElement('p',null,title),ErrorState:({message})=>React.createElement('p',null,message)};
 const workspace=load('components/analytics-workspace.tsx',{'react':mockedReact,'next/navigation':{usePathname:()=>'/reports/analytics',useRouter:()=>({replace(){}}),useSearchParams:()=>q},'../lib/api':{},'./report-overview':overview,'./report-components':components,'./report-charts':charts,'./report-filters':filters,'./report-export-menu':exportsModule,'./report-attention-case':attentionModule,'../lib/analytics-navigation':navigation,'../lib/auth-context':{useAuth:()=>({session:selected,can:p=>permissions.includes(p)})},'../lib/academic-year-context':{useAcademicYear:()=>({selectedId:'year',years:[{id:'year',name:'2026–2027'}]})},'./ui':ui});
 return html(workspace.AnalyticsWorkspace,{});
}
for(const leaf of ['overview','classes','academic','exams','subjects','attendance','homework','attention','teachers','admissions','syllabus','students'])test('workspace renders '+leaf+' with its scoped snapshot and global filters',()=>{
 const result=renderWorkspace(leaf);assert.match(result,/Snapshot ready/);assert.match(result,/Report filters/);assert.doesNotMatch(result,/NaN|Infinity/);
});
test('export utility keeps machine template keys and includes all supported formats',()=>{
 const result=renderWorkspace('homework',session.permissions,'export');assert.match(result,/value="HOMEWORK" selected=""/);assert.match(result,/>PDF</);assert.match(result,/>XLSX</);assert.match(result,/>CSV</);
});
test('export actions are absent for roles without export access',()=>{
 const result=renderWorkspace('overview',session.permissions.filter(p=>p!=='REPORT_EXPORT'));assert.doesNotMatch(result,/Export history|>Export</);
});
test('unknown or denied academic report has explicit permission state',()=>{
 assert.match(renderWorkspace('academic',['REPORT_VIEW']),/unavailable or not permitted/);
});

test('history remains accessible without a loaded report snapshot',()=>{
 const result=html(exportsModule.ExportMenu,{token:'t',report:null,view:'overview',historyOnly:true,run:async()=>{},busy:false,onHistory(){}});
 assert.match(result,/No exports yet/);assert.doesNotMatch(result,/Queue report/);
});
test('snapshot status explicitly identifies expired snapshots',()=>{
 const report=fixture();report.expiresAt='2000-01-01T00:00:00Z';
 assert.match(html(components.SnapshotStatus,{report,onCopy(){}}),/Snapshot expired/);
});
test('contextual AI displays the current evidence category without approving a draft implicitly',()=>{
 const result=html(components.InsightPanel,{context:'attendance',insight:{status:'DRAFT',insights:{caveat:'Review',findings:[{evidenceKey:'attendance',summary:'Attendance finding',recommendation:'Review'},{evidenceKey:'homework',summary:'Homework finding',recommendation:'Review'}]}},onGenerate(){},onApprove(){}});
 assert.match(result,/Attendance finding/);assert.doesNotMatch(result,/Homework finding/);assert.match(result,/Draft/);
});
test('support cases show readable status and student drill-down without exposing enrollment IDs',()=>{
 const result=html(attentionModule.AttentionCase,{row:{id:'case',enrollmentId:'private-id',indicator:'LOW_ATTENDANCE',status:'OPEN',severity:'REVIEW',events:[]},owners:[],studentName:'Test Student',onStudent(){},canManage:false,busy:false,onSave:async()=>{}});
 assert.match(result,/Test Student/);assert.match(result,/Low attendance/);assert.doesNotMatch(result,/private-id|Save follow-up/);
});
