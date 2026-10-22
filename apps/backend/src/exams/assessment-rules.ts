import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const label=z.string().trim().min(1).max(200);
const key=z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const unique=(items:{key:string}[])=>new Set(items.map(x=>x.key)).size===items.length;
const componentSchema=z.object({key,label,maximum:z.number().positive().max(10000),weight:z.number().positive().max(100)}).strict();
export const assessmentConfigSchema=z.object({
 type:z.enum(['OBSERVATION','COMPETENCY','GRADE','MARKS','MIXED']),
 terms:z.array(z.object({key,label,annual:z.boolean().default(false)}).strict()).min(1).max(12).refine(unique,'Term keys must be unique.'),
 components:z.array(z.object({key,label,maximum:z.number().positive().max(10000),weight:z.number().positive().max(100)}).strict()).max(20).default([]).refine(unique,'Component keys must be unique.'),
 grades:z.array(z.object({label,minimum:z.number().min(0).max(100)}).strict()).max(30).default([]),
 passPercent:z.number().min(0).max(100).nullable().default(null),
 ratings:z.array(z.object({key,label}).strict()).min(1).max(20).refine(unique,'Rating keys must be unique.'),
 competencies:z.array(z.object({key,label,domain:label,outcome:label,material:z.string().max(300).optional(),subjectId:z.string().optional()}).strict()).max(300).default([]).refine(unique,'Competency keys must be unique.'),
 subjectOverrides:z.array(z.object({subjectId:label,components:z.array(componentSchema).min(1).max(20).refine(unique,'Component keys must be unique.'),passPercent:z.number().min(0).max(100).nullable().optional()}).strict()).max(100).default([]),
 branding:z.object({principalName:z.string().max(200).optional(),signature:z.string().max(300000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).optional()}).strict().optional(),
}).strict().superRefine((c,ctx)=>{
 if(['MARKS','MIXED'].includes(c.type)&&(!c.components.length||Math.abs(c.components.reduce((n,x)=>n+x.weight,0)-100)>0.000001))ctx.addIssue({code:'custom',message:'Marks component weights must total 100.'});
 if(['OBSERVATION','COMPETENCY'].includes(c.type)&&(c.components.length||c.passPercent!==null||c.grades.length))ctx.addIssue({code:'custom',message:'Developmental assessments cannot contain marks, percentages or pass/fail scales.'});
 if(['OBSERVATION','COMPETENCY','MIXED'].includes(c.type)&&!c.competencies.length)ctx.addIssue({code:'custom',message:'Configure at least one competency.'});
 if(c.type==='GRADE'&&!c.grades.length)ctx.addIssue({code:'custom',message:'Configure grade labels.'});
 if(new Set(c.grades.map(g=>g.label)).size!==c.grades.length||new Set(c.grades.map(g=>g.minimum)).size!==c.grades.length)ctx.addIssue({code:'custom',message:'Grade labels and boundaries must be unique.'});
 if(new Set(c.subjectOverrides.map(s=>s.subjectId)).size!==c.subjectOverrides.length||c.subjectOverrides.some(s=>Math.abs(s.components.reduce((n,c)=>n+c.weight,0)-100)>0.000001))ctx.addIssue({code:'custom',message:'Subject overrides must be unique with weights totaling 100.'});
 if(c.subjectOverrides.length&&!['MARKS','MIXED'].includes(c.type))ctx.addIssue({code:'custom',message:'Subject component overrides require a marks-based pattern.'});
});
export type AssessmentConfig=z.infer<typeof assessmentConfigSchema>;
export function subjectAssessment(config:AssessmentConfig,subjectId:string):AssessmentConfig{const override=config.subjectOverrides?.find(s=>s.subjectId===subjectId);return override?{...config,components:override.components,passPercent:override.passPercent===undefined?config.passPercent:override.passPercent}:config;}
export const recordSchema=z.object({enrollmentId:label,state:z.enum(['PRESENT','ABSENT','EXEMPT']).default('PRESENT'),scores:z.record(z.number().finite().min(0)).default({}),grade:z.string().max(200).optional(),remarks:z.string().max(2000).default('')}).strict();
export function parseAssessment<T extends z.ZodTypeAny>(schema:T,value:unknown):z.output<T>{const r=schema.safeParse(value);if(!r.success)throw new BadRequestException(r.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '));return r.data;}
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function calculateDraftAssessment(config:AssessmentConfig,record:z.infer<typeof recordSchema>){
 if(record.state==='PRESENT'){
  if(config.type==='GRADE'&&!record.grade){if(Object.keys(record.scores).length)throw new BadRequestException('Grade-only assessments cannot contain scores.');return {state:record.state,total:null,maximum:null,percentage:null,grade:null,passed:null,remarks:record.remarks};}
  if(['MARKS','MIXED'].includes(config.type)&&config.components.some(c=>record.scores[c.key]===undefined)){
   for(const [key,score] of Object.entries(record.scores)){const c=config.components.find(c=>c.key===key);if(!c||!Number.isFinite(score)||score<0||score>c.maximum)throw new BadRequestException('Invalid draft component score.');}
   return {state:record.state,total:null,maximum:null,percentage:null,grade:null,passed:null,remarks:record.remarks};
  }
 }
 return calculateAssessment(config,record);
}
export function calculateAssessment(config:AssessmentConfig,record:z.infer<typeof recordSchema>){
 if(['OBSERVATION','COMPETENCY'].includes(config.type))throw new BadRequestException('Use observations for this assessment.');
 if(record.state!=='PRESENT'){
  if(Object.keys(record.scores).length||record.grade)throw new BadRequestException('Absent/exempt students must not have scores or grades.');
  return {state:record.state,total:null,maximum:null,percentage:null,grade:null,passed:null,remarks:record.remarks};
 }
 if(config.type==='GRADE'){
  if(Object.keys(record.scores).length||!config.grades.some(g=>g.label===record.grade))throw new BadRequestException('Select a configured grade without numeric scores.');
  return {state:record.state,total:null,maximum:null,percentage:null,grade:record.grade,passed:null,remarks:record.remarks};
 }
 if(Object.keys(record.scores).length!==config.components.length||Object.keys(record.scores).some(k=>!config.components.some(c=>c.key===k)))throw new BadRequestException('Enter every configured component exactly once.');
 let total=0,maximum=0,weighted=0;
 for(const component of config.components){const score=record.scores[component.key];if(!Number.isFinite(score)||score<0||score>component.maximum)throw new BadRequestException(component.label+' must be between 0 and '+component.maximum+'.');total+=score;maximum+=component.maximum;weighted+=score/component.maximum*component.weight;}
 const grade=[...config.grades].sort((a,b)=>b.minimum-a.minimum).find(g=>weighted>=g.minimum)?.label??null;
 return {state:record.state,total:round(total),maximum:round(maximum),percentage:round(weighted),grade,passed:config.passPercent===null?null:weighted>=config.passPercent,remarks:record.remarks};
}
export const assessmentDefaults={ratings:[{key:'NOT_OBSERVED',label:'Not Yet Observed'},{key:'EMERGING',label:'Emerging'},{key:'DEVELOPING',label:'Developing'},{key:'INDEPENDENT',label:'Independent'}],terms:[{key:'T1',label:'Term 1'},{key:'T2',label:'Term 2'},{key:'T3',label:'Term 3'},{key:'T4',label:'Term 4'},{key:'ANNUAL',label:'Annual',annual:true}]};
