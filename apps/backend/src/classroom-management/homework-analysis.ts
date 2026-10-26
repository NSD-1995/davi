export const homeworkCompleted=(status:string)=>['COMPLETED','REVIEWED'].includes(status);
const day=(value:Date|string)=>new Date(value).getTime();
const calendarDay=(value:Date|string)=>Math.floor((day(value)+330*60000)/86400000);
export function homeworkAnalysis(submissions:any[],dueAt?:Date|string,createdAt?:Date|string,now=new Date()) {
 const students=submissions.map(s=>{
  const completed=homeworkCompleted(s.status),overdueDays=dueAt?Math.max(0,calendarDay(now)-calendarDay(dueAt)):0;
  return {submissionId:s.id,enrollmentId:s.enrollmentId,
   name:[s.enrollment.student.user.firstName,s.enrollment.student.user.lastName].filter(Boolean).join(' '),
   admissionNumber:s.enrollment.admissionNumber,rollNumber:s.enrollment.rollNumber,status:s.status,completed,
   submittedAt:s.submittedAt,feedback:s.feedback,
   daysPending:!completed&&createdAt?Math.max(0,calendarDay(now)-calendarDay(createdAt)):0,
   overdueDays:completed?0:overdueDays,
   completedLate:completed&&dueAt&&s.submittedAt?calendarDay(s.submittedAt)>calendarDay(dueAt):false,
  };
 });
 const completed=students.filter(s=>s.completed).length,total=students.length;
 return {total,completed,incomplete:total-completed,completionPercentage:total?Math.round(completed/total*100):0,students};
}
