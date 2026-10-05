import { z } from 'zod';

const title = z.string().trim().min(1).max(300);
const text = z.string().trim().min(1).max(12000);
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + 'T00:00:00Z');
  return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
}, 'Invalid date');
export const scopeSchema = z.object({ schoolId: z.string().uuid(), academicYearId: z.string().uuid(), classId: z.string().uuid(), sectionId: z.string().uuid(), subjectId: z.string().uuid() }).strict();
export const topicSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/), title,
  subtopics: z.array(title).max(50), outcomes: z.array(title).min(1).max(30),
  prerequisites: z.array(z.string().max(60)).max(30), periods: z.number().int().min(1).max(60),
}).strict();
export const curriculumSchema = z.object({ units: z.array(z.object({
  title, termId: z.string().uuid(), lessons: z.array(z.object({ title, topics: z.array(topicSchema).min(1).max(100) }).strict()).min(1).max(100),
}).strict()).min(1).max(50) }).strict().superRefine((value, ctx) => {
  const topics = value.units.flatMap(u => u.lessons.flatMap(l => l.topics));
  const codes = new Set(topics.map(t => t.code));
  if (codes.size !== topics.length) ctx.addIssue({code:'custom',message:'Topic codes must be unique.'});
  if (topics.length > 500) ctx.addIssue({code:'custom',message:'Maximum 500 topics.'});
  const seen = new Set<string>();
  for (const topic of topics) {
    if (topic.prerequisites.some(p => !seen.has(p))) ctx.addIssue({code:'custom',message:`Prerequisites for ${topic.code} must refer to earlier topics.`});
    seen.add(topic.code);
  }
});
export const calendarSchema = z.object({
  terms: z.array(z.object({id:z.string().uuid(),start:dateOnly,end:dateOnly}).strict()).min(1).max(12),
  workingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  holidays: z.array(z.object({date:dateOnly,label:title}).strict()).max(400),
  unavailableDates: z.array(dateOnly).max(400),
  weeklySlots: z.array(z.object({weekday:z.number().int().min(1).max(7),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),minutes:z.number().int().min(10).max(180)}).strict()).max(100),
  revisionPeriods: z.number().int().min(0).max(100),
}).strict().superRefine((v,ctx)=>{
  const sorted=[...v.terms].sort((a,b)=>a.start.localeCompare(b.start));
  if(new Set(v.terms.map(t=>t.id)).size!==v.terms.length) ctx.addIssue({code:'custom',message:'Term IDs must be unique.'});
  sorted.forEach((t,i)=>{if(t.start>t.end || (i>0 && sorted[i-1].end>=t.start))ctx.addIssue({code:'custom',message:'Term dates must be ordered and cannot overlap.'});});
  for(let i=0;i<v.weeklySlots.length;i++) {
    const a=v.weeklySlots[i],start=Number(a.start.slice(0,2))*60+Number(a.start.slice(3));
    if(start+a.minutes>1440)ctx.addIssue({code:'custom',message:'A period cannot cross midnight.'});
    for(const b of v.weeklySlots.slice(i+1)){const other=Number(b.start.slice(0,2))*60+Number(b.start.slice(3));if(a.weekday===b.weekday&&start<other+b.minutes&&other<start+a.minutes)ctx.addIssue({code:'custom',message:'Weekly periods cannot overlap.'});}
  }
});
export const createProgramSchema = scopeSchema.extend({name:title,syllabusId:z.string().uuid()}).strict();
export const reviewProgramSchema = z.object({revision:z.number().int().min(0),curriculum:curriculumSchema,calendar:calendarSchema}).strict();
export const revisionSchema = z.object({revision:z.number().int().min(0)}).strict();
export const planSchema = revisionSchema.extend({from:dateOnly}).strict();
export const progressSchema = z.object({status:z.enum(['COMPLETED','POSTPONED','RETEACH']),notes:z.string().max(4000),revision:z.number().int().min(0)}).strict();
export const lessonContentSchema = z.object({title,objectives:z.array(title).min(1).max(30),materials:z.array(title).max(30),teachingSteps:z.array(text).min(1).max(30),activities:z.array(text).min(1).max(30),assessment:text,homework:text,differentiation:text}).strict();
export const questionSchema = z.object({code:z.string().regex(/^[A-Za-z0-9_-]{1,60}$/),topicCode:z.string().max(60),outcome:title,prompt:text,answer:text,marks:z.number().int().min(1).max(100),difficulty:z.enum(['EASY','MEDIUM','HARD'])}).strict();
export const paperSchema = z.object({title,instructions:text,questions:z.array(questionSchema).min(1).max(50)}).strict().refine(v=>new Set(v.questions.map(q=>q.code)).size===v.questions.length,'Question codes must be unique.');
export const generatePaperSchema = z.object({kind:z.enum(['HOMEWORK','ASSESSMENT']),topicCodes:z.array(z.string().max(60)).min(1).max(30),questionCount:z.number().int().min(1).max(30),dueDate:dateOnly}).strict();
export const marksSchema = z.object({revision:z.number().int().min(0),enrollmentId:z.string().uuid(),absent:z.boolean(),scores:z.array(z.object({questionCode:z.string().max(60),marks:z.number().min(0).max(100)}).strict()).max(50)}).strict();
export const interventionSchema = z.object({enrollmentId:z.string().uuid(),topicCode:z.string().max(60),action:text,dueDate:dateOnly}).strict();
export const insightSchema = z.object({audience:z.enum(['TEACHER','PARENT','ADMIN']),enrollmentId:z.string().uuid().optional()}).strict().refine(v=>v.audience!=='PARENT'||!!v.enrollmentId,'Choose a student for a parent summary.');
export const summarySchema = z.object({summary:text,strengths:z.array(title).max(30),needsSupport:z.array(title).max(30),nextSteps:z.array(title).min(1).max(30),limitations:text}).strict();
export type Curriculum=z.infer<typeof curriculumSchema>;
export type Calendar=z.infer<typeof calendarSchema>;

