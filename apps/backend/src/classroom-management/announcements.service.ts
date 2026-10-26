import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
export const announcementSchema=z.object({academicYearId:z.string().uuid(),classId:z.string().uuid().nullable().default(null),sectionId:z.string().uuid().nullable().default(null),title:z.string().trim().min(1).max(200),message:z.string().trim().min(1).max(5000),status:z.enum(['DRAFT','PUBLISHED','ARCHIVED']).default('DRAFT')}).strict().refine(d=>!d.sectionId||!!d.classId,'Choose a class before a section.');
@Injectable()
export class AnnouncementsService {
 constructor(private readonly db:PrismaService){}
 private school(s:string|null):asserts s is string{if(!s)throw new ForbiddenException('A school account is required.');}
 async targets(s:string|null,year:string){this.school(s);await this.year(s,year);return this.db.schoolClass.findMany({where:{schoolId:s,academicYearId:year},select:{id:true,name:true,sections:{select:{id:true,name:true}}},orderBy:{name:'asc'}});}
 private async year(s:string,year:string){if(!z.string().uuid().safeParse(year).success||!await this.db.academicYear.findFirst({where:{id:year,schoolId:s}}))throw new BadRequestException('Select an academic year in your school.');}
 async list(s:string|null,year:string){this.school(s);await this.year(s,year);const [rows,classes]=await Promise.all([this.db.classAnnouncement.findMany({where:{schoolId:s,academicYearId:year},orderBy:{createdAt:'desc'}}),this.targets(s,year)]);return rows.map(row=>{const c=classes.find(c=>c.id===row.classId);return {...row,scope:!row.classId?'Whole school':row.sectionId?'Class / section':'Whole class',className:c?.name||null,sectionName:c?.sections.find(section=>section.id===row.sectionId)?.name||null};});}
 async save(s:string|null,actorId:string,raw:unknown,id?:string){
  this.school(s);const parsed=announcementSchema.safeParse(raw);if(!parsed.success)throw new BadRequestException(parsed.error.issues.map(i=>i.message));const d=parsed.data;await this.year(s,d.academicYearId);
  if(d.classId&&!await this.db.schoolClass.findFirst({where:{id:d.classId,schoolId:s,academicYearId:d.academicYearId}}))throw new BadRequestException('Choose a class in the selected school and year.');
  if(d.sectionId&&!await this.db.section.findFirst({where:{id:d.sectionId,schoolId:s,classId:d.classId!}}))throw new BadRequestException('Choose a section in the selected class.');
  return this.db.$transaction(async tx=>{
   const before=id?await tx.classAnnouncement.findFirst({where:{id,schoolId:s}}):null;if(id&&!before)throw new NotFoundException('Announcement not found.');
   if(before&&before.academicYearId!==d.academicYearId)throw new BadRequestException('An announcement cannot be moved to another academic year.');
   if(before?.publishedAt&&(before.classId!==d.classId||before.sectionId!==d.sectionId))throw new BadRequestException('Create a new announcement to change the audience after publication.');
   const firstPublish=d.status==='PUBLISHED'&&!before?.publishedAt;
   const data={...d,schoolId:s,audience:'ALL',publishedAt:firstPublish?new Date():before?.publishedAt||null};
   const row=id?await tx.classAnnouncement.update({where:{id},data}):await tx.classAnnouncement.create({data});
   if(firstPublish){
    const recipients=new Set<string>();
    if(d.classId){const scope={schoolId:s,academicYearId:d.academicYearId,classId:d.classId,...(d.sectionId?{sectionId:d.sectionId}:{})};
     const [students,teachers]=await Promise.all([tx.studentEnrollment.findMany({where:{...scope,status:'ACTIVE'},include:{student:{include:{studentParents:{where:{status:'ACTIVE',canViewAcademics:true},include:{parent:{include:{memberships:{where:{schoolId:s,status:'ACTIVE'}}}}}}}}}}),tx.teacherAcademicAssignment.findMany({where:{...scope,isActive:true},select:{teacher:{select:{userId:true}}}})]);
     for(const enrollment of students){recipients.add(enrollment.student.userId);for(const link of enrollment.student.studentParents)if(link.parent.memberships.length)recipients.add(link.parent.userId);}
     for(const assignment of teachers)recipients.add(assignment.teacher.userId);
    }
    const recipientIds:Array<string|null>=d.classId?[...recipients]:[null];
    if(recipientIds.length)await tx.notification.createMany({data:recipientIds.map(recipientId=>({schoolId:s,recipientId,channel:'IN_APP',title:d.title,message:d.message,status:'SENT',sentAt:new Date(),dedupeKey:'ANNOUNCEMENT:'+row.id+':'+(recipientId||'ALL')})),skipDuplicates:true});
   }
   await tx.auditLog.create({data:{schoolId:s,actorId,method:id?'PATCH':'POST',path:'/announcements',action:firstPublish?'ANNOUNCEMENT_PUBLISHED':'ANNOUNCEMENT_SAVED',entityType:'ClassAnnouncement',entityId:row.id}});
   return row;
  });
 }
}
