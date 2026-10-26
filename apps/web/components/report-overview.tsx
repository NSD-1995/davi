'use client';
import { MetricCard } from './report-components';

export const reportDescriptions: Record<string, string> = {
 overview: 'Your school at a glance: participation, learning and the areas that need a closer look.',
 classes: 'Compare section capacity, participation and completion across your school.',
 academic: 'Understand achievement within comparable exams and assessment patterns.',
 exams: 'Track published assessments, recorded attempts and results still to be entered.',
 subjects: 'Explore subject results and identify differences within comparable assessments.',
 attendance: 'Follow daily participation and distinguish absence from missing attendance records.',
 homework: 'See completion, overdue work and submissions waiting for teacher review.',
 students: 'Choose a student to explore their learning journey and recorded history.',
 attention: 'Review evidence, assign an owner and follow through on student support.',
 teachers: 'Understand teaching assignments, homework review workload and recorded staff attendance.',
 syllabus: 'Review scheduled lesson plans and their recorded coverage.',
 admissions: 'Monitor applications and admission payments recorded during this period.',
 insights: 'Compare periods and turn recorded evidence into reviewed recommendations.',
 exports: 'Prepare a report, choose its format and manage your downloads.',
};
const display = (v: any, unit = '') => v === null || v === undefined ? '—' : `${v}${unit}`;
export function ReportOverview({ view, report }: { view: string; report: any }) {
 const s = report.summary, c = report.capabilities;
 const metrics: [string, any, string?][] = [];
 const add = (label: string, value: any, unit = '') => metrics.push([label, value, unit]);
 if (['overview','classes','students','insights'].includes(view)) { add('Students in selection', s.students); if(view!=='overview'){add('Classes', s.classes); add('Sections', s.sections);} }
 if(view==='overview'&&c.attention)add('Students needing review',s.attentionStudents);
 if (['overview','attendance','students'].includes(view) && c.attendance) { add('Attendance', s.attendancePercent, '%'); if(view!=='overview')add('Missing student-days', s.missingDays); }
 if (['overview','homework','students'].includes(view) && c.homework) { add('Homework completion', s.homeworkPercent, '%'); if(view!=='overview')add('Overdue assignments', s.homeworkOverdue); if(view==='homework'){add('Completed assignments',s.homeworkCompleted);add('Awaiting review',s.reviewBacklog);} }
 if (['academic','exams','subjects'].includes(view) && c.exams) { add('Expected attempts',s.examExpectedAttempts);add('Recorded attempts',s.examRecordedAttempts);add('Assessment completion',s.examCompletionPercent,'%');add('Valid numeric attempts',s.numericAttempts); }
 if(view==='attention' && c.attention){add('Students with evidence',s.attentionStudents);add('Students in selection',s.students);}
 if(view==='teachers' && c.staff){add('Teachers',s.teachers);add('Awaiting homework review',s.reviewBacklog);}
 if(view==='syllabus' && c.lessons){add('Scheduled lesson plans',s.lessonPlans);add('Average recorded coverage',s.lessonPlanCoverage,'%');}
 if(view==='admissions' && c.admissions){add('Applications in period',report.admissions.applications.reduce((n:number,r:any)=>n+r._count._all,0));add('Enrollments created',s.enrollmentsCreated);}
 const bars = view==='exams' && c.exams ? [
  {label:'Expected attempts',value:s.examExpectedAttempts},{label:'Recorded attempts',value:s.examRecordedAttempts},{label:'Valid numeric attempts',value:s.numericAttempts}
 ] : view==='classes' ? report.comparisons.map((r:any)=>({label:`${r.className} · ${r.sectionName}`,value:r.currentActiveStudents})) : [];
 const maximum=Math.max(1,...bars.map((r:any)=>r.value||0));
 return <>
 {metrics.length>0&&<div className="report-metrics">{metrics.map(([label,v,unit])=><MetricCard key={label} label={label} value={display(v,unit)}/>)}</div>}
 {bars.length>0&&<section className="card report-bars"><h2>{view==='homework'?'Homework completion breakdown':view==='exams'?'Assessment recording progress':'Current section enrollment'}</h2>{view==='classes'&&<p>Current active enrollment for the sections shown on this page; date filters do not change current capacity.</p>}{bars.map((r:any)=><div className="report-bar" key={r.label}><span>{r.label}</span><div><i style={{width:`${Math.max(0,(r.value||0)/maximum*100)}%`}}/></div><strong>{display(r.value)}</strong></div>)}</section>}
 </>;
}
