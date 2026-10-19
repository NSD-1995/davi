import { StudentAdmissionsService } from './student-admissions.service';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AdmissionsCrmService } from './admissions-crm.service';
import { EnrollmentAllocationService } from './enrollment-allocation.service';
import { admissionsTransaction } from './admissions-transaction';
import { applicationSchema, id, mobile, parse, reason, text } from './admissions-rules';
import { capacityAllocation, sectionProposal } from './capacity-rules';
const rowSchema=z.object({firstName:text,lastName:z.string().trim().max(200).default(''),className:text,parentName:text,mobile,admissionNumber:z.string().trim().max(200).optional(),fatherName:z.string().trim().max(200).optional(),fatherMobile:mobile.optional(),motherName:z.string().trim().max(200).optional(),motherMobile:mobile.optional(),parentEmail:z.string().email().optional(),address:z.string().max(2000).optional(),dateOfBirth:z.string().date().optional(),gender:z.enum(['MALE','FEMALE','OTHER']).optional(),extraFields:z.record(z.string().max(2000)).default({})}).strict();
const intakeSchema=z.object({academicYearId:id,rows:z.array(rowSchema).min(1).max(500)}).strict();
export function parseIntake<S extends z.ZodTypeAny>(schema:S,body:unknown):z.output<S>{
 const result=schema.safeParse(body);if(result.success)return result.data;
 const issues=result.error.issues.map(issue=>({row:issue.path[0]==='rows'&&typeof issue.path[1]==='number'?issue.path[1]+2:null,field:issue.path.slice(issue.path[0]==='rows'?2:0).join('.'),message:issue.message}));
 throw new BadRequestException({message:'Correct the highlighted fields before generating section proposals.',issues});
}
const hash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
@Injectable()
export class StudentIntakeService {
 constructor(private readonly db:PrismaService,private readonly crm:AdmissionsCrmService,private readonly allocation:EnrollmentAllocationService,private readonly admissions:StudentAdmissionsService){}
 async build(tx:any,schoolId:string,data:z.infer<typeof intakeSchema>){
  if(!await tx.academicYear.findFirst({where:{id:data.academicYearId,schoolId}}))throw new BadRequestException('Select an academic year in this school.');
  const classes=await tx.schoolClass.findMany({where:{schoolId,academicYearId:data.academicYearId,status:'ACTIVE'},include:{sections:{orderBy:{name:'asc'}}},orderBy:{id:'asc'}});
  const settings=await tx.schoolSetting.findUnique({where:{schoolId}}),policy=settings?.sectionCapacityPolicy || {};
  const admissionSettings=await this.crm.settings(schoolId,tx);
  const rows:any[]=[],errors:any[]=[],seen=new Set<string>();
  for(const [index,input] of data.rows.entries()){
   const c=classes.find((c:any)=>c.name.trim().toLowerCase()===input.className.toLowerCase());
   if(!c){errors.push({row:index+2,message:'Class '+input.className+' is not active in the selected year.'});continue;}
   if(await tx.studentEnrollment.findFirst({where:{schoolId,academicYearId:data.academicYearId,OR:[...(input.admissionNumber?[{admissionNumber:input.admissionNumber}]:[]),{student:{user:{firstName:{equals:input.firstName,mode:'insensitive'},lastName:{equals:input.lastName,mode:'insensitive'}},studentParents:{some:{parent:{user:{phone:input.mobile}}}}}}]}})){errors.push({row:index+2,message:'Student already exists in this academic year. Review the Student Directory or use migration duplicate resolution.'});continue;}
   const studentName=(input.firstName+' '+input.lastName).trim().replace(/\s+/g,' ');
   const key=[c.id,studentName.toLowerCase(),input.mobile].join(':');
   if(seen.has(key)){errors.push({row:index+2,message:'Duplicate student in upload.'});continue;}seen.add(key);
   if(await tx.admissionApplication.findFirst({where:{schoolId,academicYearId:data.academicYearId,classId:c.id,mobile:input.mobile,studentName:{equals:studentName,mode:'insensitive'}}})){errors.push({row:index+2,message:'An application already exists for this student. Review it in Admissions.'});continue;}
   const app=parse(applicationSchema,{academicYearId:data.academicYearId,classId:c.id,student:{firstName:input.firstName,lastName:input.lastName,admissionNumber:input.admissionNumber,address:input.address,...(input.dateOfBirth?{dateOfBirth:input.dateOfBirth}:{}),...(input.gender?{gender:input.gender}:{})},parents:(input.fatherName||input.motherName)?[...(input.fatherName?[{firstName:input.fatherName,lastName:'',mobile:input.fatherMobile,email:input.parentEmail,relationship:'FATHER',isPrimary:true}]:[]),...(input.motherName?[{firstName:input.motherName,lastName:'',mobile:input.motherMobile,email:input.fatherName?undefined:input.parentEmail,relationship:'MOTHER',isPrimary:!input.fatherName}]:[])]:[{firstName:input.parentName,lastName:'',mobile:input.mobile,email:input.parentEmail,relationship:'GUARDIAN',isPrimary:true}],extraFields:input.extraFields});
   const missing=admissionSettings.extraFields.filter((f:any)=>f.required && !input.extraFields[f.key]?.trim());
   if(missing.length){errors.push({row:index+2,message:'Missing required application fields: '+missing.map((f:any)=>f.label).join(', ')});continue;}
   if(Object.keys(input.extraFields).some(key=>!admissionSettings.extraFields.some((f:any)=>f.key===key))){errors.push({row:index+2,message:'Unknown application extra field.'});continue;}
   rows.push({row:index+2,key:'upload-'+index,studentName,classId:c.id,application:app});
  }
  const groups:any[]=[];
  for(const c of classes.filter((c:any)=>rows.some(r=>r.classId===c.id))){
   const enrolled=await tx.studentEnrollment.findMany({where:{schoolId,academicYearId:data.academicYearId,classId:c.id,status:'ACTIVE'},orderBy:[{createdAt:'asc'},{id:'asc'}]});
   const pending=await tx.admissionApplication.findMany({where:{schoolId,academicYearId:data.academicYearId,classId:c.id,enrollmentId:null,decision:{notIn:['REJECTED','WITHDRAWN']},joiningStatus:{not:'NOT_JOINED'}},orderBy:{id:'asc'},select:{id:true,version:true}});
   const incoming=rows.filter(r=>r.classId===c.id);
   const occupied=Object.fromEntries(c.sections.map((s:any)=>[s.id,enrolled.filter((e:any)=>e.sectionId===s.id).length]));
   try{
    const sections=sectionProposal(c,policy,enrolled.length+pending.length+incoming.length,occupied);
    const students=[...enrolled.filter((e:any)=>!e.sectionId),...pending.map((p:any)=>({id:'pending-'+p.id,version:p.version})),...incoming.map(r=>({id:r.key,version:1}))];
    const distribution=capacityAllocation(students,sections.map((s:any)=>({id:s.key,capacity:s.usable,occupied:s.occupied})),policy,data.academicYearId);
    groups.push({classId:c.id,className:c.name,academicGroup:c.academicGroup,confirmed:enrolled.length,pending:pending.length,uploaded:incoming.length,sections,distribution:distribution.distribution,waitlist:distribution.waitlist,enrollmentVersions:enrolled.map((e:any)=>({id:e.id,version:e.version,sectionId:e.sectionId})),pendingVersions:pending});
    for(const r of incoming){const assignment=distribution.assignments.find((a:any)=>a.enrollmentId===r.key);r.suggestedSection=sections.find((s:any)=>s.key===assignment?.sectionId)?.name || 'Waitlist';}
   }catch(e:any){errors.push({className:c.name,message:e.message});}
  }
  const result={academicYearId:data.academicYearId,rows,groups,errors,policy,admissionSettings};
  return {...result,expectedPreview:hash(result)};
 }
 async preview(schoolId:string|null,body:unknown){this.allocation.school(schoolId);const data=parseIntake(intakeSchema,body);return admissionsTransaction(this.db,tx=>this.build(tx,schoolId,data));}
 async confirm(schoolId:string|null,actorId:string,body:unknown){
  this.allocation.school(schoolId);const data=parseIntake(intakeSchema.extend({expectedPreview:z.string().length(64),reason,approveSections:z.boolean()}).strict(),body);
  return admissionsTransaction(this.db,async tx=>{
   await this.allocation.permission(tx,schoolId,actorId,'ADMISSIONS_MANAGE');
   await this.allocation.permission(tx,schoolId,actorId,'STUDENT_CREATE');
   const inputHash=hash({academicYearId:data.academicYearId,rows:data.rows});const previous=await tx.auditLog.findFirst({where:{schoolId,action:'STUDENT_INTAKE_APPROVED',metadata:{path:['inputHash'],equals:inputHash}}});if(previous)return {...previous.metadata.result,reused:true};
   const current=await this.build(tx,schoolId,{academicYearId:data.academicYearId,rows:data.rows});
   if(current.errors.length)throw new BadRequestException('Resolve all upload and capacity errors before importing.');
   if(current.expectedPreview!==data.expectedPreview)throw new ConflictException('Intake, capacity or enrollment changed. Generate a fresh preview.');
   const proposed=current.groups.flatMap((g:any)=>g.sections.filter((s:any)=>!s.id).map((s:any)=>({...s,classId:g.classId})));
   if(proposed.length){if(!data.approveSections)throw new BadRequestException('Approve the proposed section creation.');await this.allocation.permission(tx,schoolId,actorId,'SECTION_CREATE');await this.allocation.permission(tx,schoolId,actorId,'ENROLLMENT_ALLOCATE');}
   for(const s of proposed)await tx.section.create({data:{schoolId,classId:s.classId,name:s.name,capacity:s.capacity,status:'ACTIVE'}});
   const enrolled:any[]=[];
   for(const row of current.rows){
    const section=row.suggestedSection==='Waitlist'?null:await tx.section.findFirst({where:{schoolId,classId:row.classId,name:row.suggestedSection,status:'ACTIVE'}});
    const student=await this.admissions.create(schoolId,{student:{...row.application.student,admissionNumber:row.application.student.admissionNumber || ''},enrollment:{academicYearId:data.academicYearId,classId:row.classId,sectionId:section?.id,address:row.application.student.address},parents:row.application.parents},tx,actorId);
    enrolled.push({enrollmentId:student.enrollment.id,admissionNumber:student.enrollment.admissionNumber,sectionId:student.enrollment.sectionId});
   }
   const result={students:enrolled.length,newSections:proposed.length,enrollments:enrolled};
   await tx.auditLog.create({data:{schoolId,actorId,method:'POST',path:'/enrollment-planning/intake-confirm',action:'STUDENT_INTAKE_APPROVED',metadata:{academicYearId:data.academicYearId,inputHash,reason:data.reason,result,newSections:proposed.map((s:any)=>({classId:s.classId,name:s.name,capacity:s.capacity}))}}});
   return result;
  });
 }
}
