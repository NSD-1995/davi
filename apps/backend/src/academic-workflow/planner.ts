import { Calendar, Curriculum } from './workflow.dto';

export function flattenTopics(curriculum:Curriculum) {
  return curriculum.units.flatMap(unit=>unit.lessons.flatMap(lesson=>lesson.topics.map(topic=>({...topic,unit:unit.title,lesson:lesson.title,termId:unit.termId}))));
}

/** Calendar arithmetic is UTC date-only, independent of the server timezone. */
export function buildTeachingPlan(curriculum:Curriculum,calendar:Calendar,from:string,completed:Record<string,number>={},occupied:string[]=[],reservedThrough:Record<string,string>={}) {
  const blocked=new Set([...calendar.holidays.map(h=>h.date),...calendar.unavailableDates]);
  const taken=new Set(occupied);
  const sessions:Array<{topicCode:string;title:string;date:string;start:string;minutes:number;termId:string}>=[];
  const shortages:Array<{topicCode:string;missingPeriods:number;termId:string}>=[];
  const finished=new Set<string>();
  const finishedAt:Record<string,string>={};
  for(const term of [...calendar.terms].sort((a,b)=>a.start.localeCompare(b.start))) {
    const slots:Array<{date:string;start:string;minutes:number}>=[];
    const begin=new Date(`${term.start>from?term.start:from}T00:00:00Z`),end=new Date(`${term.end}T00:00:00Z`);
    if((+end-+begin)/86400000>550)throw new Error('A term cannot exceed 550 days.');
    for(let day=begin;day<=end;day=new Date(+day+86400000)) {
      const date=day.toISOString().slice(0,10),weekday=day.getUTCDay()||7;
      if(blocked.has(date)||!calendar.workingDays.includes(weekday))continue;
      for(const slot of [...calendar.weeklySlots].filter(s=>s.weekday===weekday).sort((a,b)=>a.start.localeCompare(b.start))) {
        if(!taken.has(`${date}:${slot.start}`))slots.push({date,start:slot.start,minutes:slot.minutes});
      }
    }
    slots.splice(Math.max(0,slots.length-calendar.revisionPeriods));
    let index=0;
    for(const topic of flattenTopics(curriculum).filter(t=>t.termId===term.id)) {
      let needed=Math.max(0,topic.periods-(completed[topic.code]||0));
      const prerequisitesReady=topic.prerequisites.every(code=>finished.has(code));
      let barrier=[reservedThrough[topic.code]||'',...topic.prerequisites.map(code=>finishedAt[code]||'')].sort().at(-1)||'';
      if(prerequisitesReady)while(needed>0&&index<slots.length){const slot=slots[index++];if(`${slot.date}:${slot.start}`<=barrier)continue;sessions.push({...slot,topicCode:topic.code,title:topic.title,termId:term.id});barrier=`${slot.date}:${slot.start}`;needed--;}
      if(needed)shortages.push({topicCode:topic.code,missingPeriods:needed,termId:term.id});
      else {finished.add(topic.code);finishedAt[topic.code]=barrier;}
    }
  }
  return {sessions,shortages};
}

/** Missing/absent results remain unknown; attendance is contextual, not mastery. */
export function analyzeEvidence(topics:ReturnType<typeof flattenTopics>,papers:any[],results:any[],enrollments:any[],attendance:any[]) {
  return enrollments.map(enrollment=>{
    const gaps=topics.map(topic=>{
      let earned=0,possible=0,evidenceCount=0;
      const outcomeTotals=new Map<string,{earned:number;possible:number}>();
      for(const paper of papers.filter(p=>p.status==='PUBLISHED')){
        const result=results.find(r=>r.paperId===paper.id&&r.enrollmentId===enrollment.id);
        if(!result||result.absent)continue;
        for(const question of paper.content.questions.filter((q:any)=>q.topicCode===topic.code)){
          const score=result.scores.find((s:any)=>s.questionCode===question.code);
          if(!score)continue;
          earned+=score.marks;possible+=question.marks;evidenceCount++;
          const prior=outcomeTotals.get(question.outcome)||{earned:0,possible:0};prior.earned+=score.marks;prior.possible+=question.marks;outcomeTotals.set(question.outcome,prior);
        }
      }
      const percentage=possible?Math.round(earned/possible*100):null;
      return {topicCode:topic.code,title:topic.title,percentage,evidenceCount,status:percentage===null?'NO_EVIDENCE':percentage<60?'NEEDS_SUPPORT':'ON_TRACK',outcomes:[...outcomeTotals].map(([outcome,v])=>({outcome,percentage:Math.round(v.earned/v.possible*100)}))};
    });
    const records=attendance.filter(a=>a.enrollmentId===enrollment.id);
    return {enrollmentId:enrollment.id,name:enrollment.student?`${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`:enrollment.id,attendance:{recordedDays:records.length,presentDays:records.filter(a=>a.status==='PRESENT').length},topics:gaps};
  });
}
