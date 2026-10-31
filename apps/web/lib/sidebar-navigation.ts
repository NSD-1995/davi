import { permittedReportPages, reportHref, reportLocation } from './analytics-navigation';

export interface SidebarLink { href: string; label: string; permission: string; all?: string[]; aliases?: string[]; icon?:string; adminOnly?:boolean }
export interface SidebarGroup { id: string; label: string; links: SidebarLink[]; direct?:boolean }
export const schoolSidebar: SidebarGroup[] = [
  {id:'dashboard',label:'Dashboard',direct:true,links:[{href:'/dashboard',label:'Dashboard',permission:''}]},
  {id:'setup',label:'School Configuration',links:[
    {href:'/school/profile',label:'School Profile & Branding',permission:'SCHOOL_PROFILE_VIEW',aliases:['/school/settings']},
    {href:'/academics/academic-years',label:'Academic Years',permission:'ACADEMIC_YEAR_VIEW'},
    {href:'/academics/classes',label:'Classes & Sections',permission:'CLASS_VIEW'},
    {href:'/academics/groups',label:'Academic Groups',permission:'TIMETABLE_VIEW'},
    {href:'/academics/subjects',label:'Subjects',permission:'SUBJECT_VIEW'},
    {href:'/people/teachers',label:'Teaching Assignments',permission:'STAFF_VIEW'},
    {href:'/academics/assessments',label:'Assessment Settings',permission:'ASSESSMENT_CONFIGURE'},
    {href:'/operations/attendance-settings',label:'Attendance Settings',permission:'staff.attendance.policy.manage'},
  ]},
  {id:'admissions',label:'Admissions',links:[
    {href:'/admissions/dashboard',label:'Admissions Overview',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/enquiries',label:'Enquiries & Follow-ups',permission:'ADMISSIONS_VIEW',aliases:['/admissions/follow-ups']},
    {href:'/admissions/applications',label:'Applications & Admissions',permission:'ADMISSIONS_VIEW',aliases:['/admissions/decisions','/admissions/joining']},
    {href:'/admissions/settings',label:'Admission Settings',permission:'ADMISSIONS_SETTINGS_MANAGE',all:['ADMISSIONS_VIEW']},
  ]},
  {id:'students',label:'Students',links:[
    {href:'/people/students',label:'Student Directory',permission:'STUDENT_VIEW'},
    {href:'/students/import-migration',label:'Student Imports',permission:'students.import.view',all:['STUDENT_VIEW'],aliases:['/students/upload']},
    {href:'/students/allocation',label:'Section Allocation',permission:'ENROLLMENT_ALLOCATE',all:['STUDENT_VIEW'],aliases:['/academics/section-capacity','/students/unassigned']},
    {href:'/students/transfers',label:'Transfers & Swaps',permission:'ENROLLMENT_MOVE',all:['STUDENT_VIEW']},
    {href:'/students/promotions',label:'Promotions',permission:'ENROLLMENT_PROMOTE',all:['STUDENT_VIEW']},
    {href:'/people/parents',label:'Parent Directory',permission:'PARENT_VIEW'},
  ]},
  {id:'workspace',label:'Class Workspace',direct:true,links:[{href:'/academics/workspace',label:'Class Workspace',permission:'CLASS_VIEW'}]},
  {id:'academics',label:'Academics',links:[
    {href:'/academics/timetables',label:'Timetables',permission:'TIMETABLE_VIEW'},
    {href:'/academics/timetable-settings',label:'Timetable Settings',permission:'TIMETABLE_VIEW'},
    {href:'/academics/period-templates',label:'Period Templates',permission:'PERIOD_TEMPLATE_VIEW'},
    {href:'/academics/academic-planner',label:'Academic Planner',permission:'LESSON_PLAN_VIEW'},
    {href:'/academics/ai-lesson-plans',label:'Syllabus & AI Plans',permission:'LESSON_PLAN_VIEW'},
  ]},
  {id:'daily',label:'Daily Operations',direct:true,links:[{href:'/operations',label:'Daily Operations',permission:'operations.dashboard.view'}]},
  {id:'operations',label:'Staff Management',links:[
    {href:'/people/staff',label:'Staff Directory',permission:'STAFF_VIEW'},
    {href:'/operations/attendance',label:'Staff Attendance',permission:'staff.attendance.view'},
    {href:'/operations/leave',label:'Leave Management',permission:'staff.leave.approve'},
    {href:'/operations/leave-policies',label:'Leave Policies',permission:'staff.leave.policy.manage'},
    {href:'/operations/duties',label:'Daily Duties',permission:'operations.tasks.manage'},
    {href:'/people/teacher-attendance',label:'Substitution Planner',permission:''},
    {href:'/operations/reports',label:'Attendance Reports',permission:'staff.attendance.view'},
  ]},
  {id:'automation',label:'Automation & Jobs',links:[{href:'/operations/settings?tab=automation',label:'Scheduled Jobs',permission:'staff.attendance.manage',adminOnly:true}]},
  {id:'communication',label:'Communication',links:[
    {href:'/academics/announcements',label:'Announcements',permission:'COMMUNICATION_VIEW'},
    {href:'/academics/holidays-events',label:'Holidays & Events',permission:'EVENT_VIEW'},
  ]},
  {id:'reports',label:'Reports & Analytics',links:[]},
  {id:'administration',label:'Administration',links:[{href:'/access/roles',label:'Roles & Permissions',permission:'ROLE_VIEW'}]},
];
export function visibleSidebar(can:(permission:string)=>boolean, search='',admin=false):SidebarGroup[] {
  const query=search.trim().toLowerCase();
  return schoolSidebar.map(group=>{
    const links:SidebarLink[]=group.id==='reports'?permittedReportPages(can).map(page=>({href:'/reports/analytics?'+reportHref(page.views[0]),label:page.key==='overview'?'School Overview':page.label,permission:'REPORT_VIEW'})):group.links;
    return {...group,links:links.filter(link=>{
      const allowed=link.href==='/people/teacher-attendance'
        ?can('timetable.substitution.view')||(can('ATTENDANCE_VIEW')&&can('STAFF_VIEW'))
        :(!link.permission||can(link.permission))&&(!link.all||link.all.every(can));
      return allowed&&(!link.adminOnly||admin)&&(!query||[group.label,link.label,link.href,...(link.aliases||[])].join(' ').toLowerCase().includes(query));
    }).map(link=>({...link,icon:link.href.startsWith('/reports/analytics?')?reportIcons[new URLSearchParams(link.href.split('?')[1]).get('view')||'overview']:sidebarIcons[link.href]}))};
  }).filter(group=>group.links.length);
}
export function sidebarLinkActive(link:SidebarLink,path:string,query='') {
  if(link.href.startsWith('/reports/analytics?')) {
    if(path!=='/reports/analytics')return false;
    const params=new URLSearchParams(query),target=new URLSearchParams(link.href.split('?')[1]);
    return reportLocation(params.get('view')||'overview',params.get('subview')||undefined).page===target.get('view');
  }
  if(link.href.includes('?')){const [base,q]=link.href.split('?');return path===base&&new URLSearchParams(query).get('tab')===new URLSearchParams(q).get('tab');}
  return [link.href,...(link.aliases||[])].some(href=>path===href||(href!=='/operations'&&href!=='/dashboard'&&path.startsWith(href+'/')));
}
export function sidebarDestination(path:string,query='') {
  for(const group of schoolSidebar){
    const link=group.links.find(link=>sidebarLinkActive(link,path,query));
    if(link)return {group,link};
  }
  if(path==='/reports/analytics'){
    const params=new URLSearchParams(query),location=reportLocation(params.get('view')||'overview',params.get('subview')||undefined);
    const labels:Record<string,string>={overview:'School Overview',classes:'Class & Section Analytics',academic:'Academic Performance',engagement:'Engagement Analytics',attention:'Student Attention Center',operations:'School Operations'};
    return {group:schoolSidebar.find(g=>g.id==='reports')!,link:{href:'/reports/analytics?view='+location.page,label:labels[location.page]||'School Overview',permission:'REPORT_VIEW'}};
  }
  return null;
}

export const sidebarIcons:Record<string,string>={
 '/dashboard':'House','/school/profile':'Palette','/academics/academic-years':'CalendarRange','/academics/classes':'School','/academics/groups':'Shapes','/academics/subjects':'BookMarked','/people/teachers':'Presentation','/academics/assessments':'ClipboardCheck','/operations/attendance-settings':'MapPinCheck',
 '/admissions/dashboard':'ChartNoAxesCombined','/admissions/enquiries':'MessagesSquare','/admissions/applications':'FileUser','/admissions/settings':'SlidersHorizontal',
 '/people/students':'GraduationCap','/students/import-migration':'FileUp','/students/allocation':'GitFork','/students/transfers':'ArrowLeftRight','/students/promotions':'TrendingUp','/people/parents':'ContactRound',
 '/academics/workspace':'PanelsTopLeft','/academics/timetables':'TableProperties','/academics/timetable-settings':'CalendarCog','/academics/period-templates':'Clock3','/academics/academic-planner':'NotebookPen','/academics/ai-lesson-plans':'Sparkles',
 '/operations':'Activity','/people/staff':'Contact','/operations/attendance':'Fingerprint','/operations/leave':'CalendarMinus','/operations/leave-policies':'ScrollText','/operations/duties':'ListTodo','/people/teacher-attendance':'UserRoundCog','/operations/reports':'ChartColumnIncreasing','/operations/settings?tab=automation':'AlarmClockCheck',
 '/academics/announcements':'Megaphone','/academics/holidays-events':'PartyPopper','/access/roles':'ShieldCheck'
};
export const reportIcons:Record<string,string>={overview:'Gauge',classes:'ChartBarStacked',academic:'Award',engagement:'HeartPulse',attention:'ScanEye',operations:'BriefcaseBusiness'};
