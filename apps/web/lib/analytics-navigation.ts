export const analyticsViews=[
 {key:'overview',label:'Overview Dashboard',group:'School',permission:'REPORT_VIEW'},
 {key:'academic',label:'Academic Performance',group:'Learning',permission:'MARKS_VIEW'},
 {key:'attention',label:'Student Attention Center',group:'Learning',permission:'REPORT_ATTENTION_VIEW'},
 {key:'classes',label:'Class & Section Analysis',group:'School',permission:'REPORT_VIEW'},
 {key:'attendance',label:'Attendance Reports',group:'Learning',permission:'ATTENDANCE_VIEW'},
 {key:'homework',label:'Homework Reports',group:'Learning',permission:'HOMEWORK_VIEW'},
 {key:'exams',label:'Exams & Marks',group:'Learning',permission:'MARKS_VIEW'},
 {key:'subjects',label:'Subject Analysis',group:'Learning',permission:'MARKS_VIEW'},
 {key:'students',label:'Student Progress / 360',group:'Learning',permission:'REPORT_VIEW'},
 {key:'teachers',label:'Teacher & Staff Reports',group:'Operations',permission:'STAFF_VIEW'},
 {key:'syllabus',label:'Syllabus & Lesson Plans',group:'Operations',permission:'LESSON_PLAN_VIEW'},
 {key:'admissions',label:'Admissions & Enrollment',group:'Operations',permission:'ADMISSIONS_VIEW'},
 {key:'fees',label:'Fees & Collections',group:'Operations',permission:'__UNAVAILABLE__'},
 {key:'insights',label:'AI Insights & Comparisons',group:'Reports',permission:'AI_GENERATE'},
 {key:'exports',label:'Report Export Center',group:'Reports',permission:'REPORT_EXPORT'},
];


// Legacy leaf views remain valid URLs. Only these six destinations are primary navigation.
export const reportPages = [
 {key:'overview',label:'Overview',description:'Decision-critical signals across your authorized school scope.',views:['overview']},
 {key:'classes',label:'Class & Section Analytics',description:'Compare sections, then explore their students and learning records.',views:['classes']},
 {key:'academic',label:'Academic Performance',description:'Comparable achievement, assessment completeness and subject results.',views:['academic','exams','subjects']},
 {key:'engagement',label:'Engagement Analytics',description:'Participation and completion, with missing records shown explicitly.',views:['attendance','homework']},
 {key:'attention',label:'Student Attention Center',description:'Review evidence, assign support and track follow-through.',views:['attention']},
 {key:'operations',label:'School Operations',description:'Staff workload, admissions and planned teaching coverage.',views:['teachers','admissions','syllabus']},
];
export function reportLocation(view='overview', subview?:string) {
 const primary=reportPages.find(p=>p.key===view);
 if(primary)return {page:primary.key,leaf:primary.views.includes(subview||'')?subview!:primary.views[0],utility:null};
 if(view==='students')return {page:'classes',leaf:'students',utility:null};
 if(view==='exports')return {page:'overview',leaf:'overview',utility:'exports'};
 if(view==='insights')return {page:'overview',leaf:'overview',utility:'insights'};
 const parent=reportPages.find(p=>p.views.includes(view));
 return {page:parent?.key||'overview',leaf:parent?view:'unavailable',utility:null};
}
export function permittedReportPages(can:(permission:string)=>boolean, scoped=false) {
 if(!can('REPORT_VIEW'))return [];
 return reportPages.map(page=>({...page,views:page.views.filter(key=>{
  const leaf=analyticsViews.find(v=>v.key===key);
  return !!leaf&&can(leaf.permission)&&(!scoped||!['teachers','admissions'].includes(key));
 })})).filter(page=>page.views.length);
}
export function reportHref(leaf:string, current?:URLSearchParams) {
 const q=new URLSearchParams(current?.toString()); const location=reportLocation(leaf);
 q.set('view',leaf==='students'?'students':location.page);q.delete('subview');q.delete('utility');
 if(leaf!=='students'&&location.leaf!==location.page)q.set('subview',location.leaf);
 if(location.utility)q.set('utility',location.utility);
 return q;
}
