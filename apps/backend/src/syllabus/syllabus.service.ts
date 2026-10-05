import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicScopeService } from '../ai/academic-scope.service';
import { lessonListSchema, syllabusScopeSchema } from './syllabus.dto';

@Injectable()
export class SyllabusService {
  constructor(private readonly prisma:PrismaService,private readonly scope:AcademicScopeService) {}
  private async authorized(user:any,value:unknown) {
    const result=syllabusScopeSchema.safeParse(value);
    if(!result.success) throw new BadRequestException(result.error.flatten());
    await this.scope.assert(user,result.data);
    const term=await this.prisma.schoolTerm.findFirst({where:{id:result.data.termId,schoolId:result.data.schoolId,academicYearId:result.data.academicYearId}});
    if(!term) throw new BadRequestException('Term is not in this school and academic year.');
    return result.data;
  }
  async terms(user:any,yearId:string) {
    if(!user.schoolId) throw new ForbiddenException('School access denied.');
    const year=await this.prisma.academicYear.findFirst({where:{id:yearId,schoolId:user.schoolId}});
    if(!year) throw new NotFoundException('Academic year not found.');
    return this.prisma.schoolTerm.findMany({where:{schoolId:user.schoolId,academicYearId:yearId},orderBy:{sortOrder:'asc'}});
  }
  async createTerm(user:any,yearId:string,name:string) {
    if(!user.schoolId) throw new ForbiddenException('School access denied.');
    if(!name?.trim() || name.length>100) throw new BadRequestException('Valid term name required.');
    await this.terms(user,yearId);
    const count=await this.prisma.schoolTerm.count({where:{schoolId:user.schoolId,academicYearId:yearId}});
    return this.prisma.schoolTerm.create({data:{schoolId:user.schoolId,academicYearId:yearId,name:name.trim(),sortOrder:count+1}});
  }
  private async extract(file:any) {
    let content='';
    if(file.mimetype==='text/plain') content=file.buffer.toString('utf8');
    else if(file.mimetype==='application/pdf') content=String((await (require('pdf-parse') as any)(file.buffer)).text||'');
    else if(file.mimetype==='application/vnd.openxmlformats-officedocument.wordprocessingml.document') content=String((await (require('mammoth') as any).extractRawText({buffer:file.buffer})).value||'');
    else throw new BadRequestException('Only TXT, PDF and DOCX files are supported.');
    if(!content.trim()) throw new BadRequestException('File contains no readable text.');
    const lines=content.split(/\r?\n/).map((line:string)=>line.replace(/^\s*(?:(?:\d+[.)]|[-•])\s*)?/u,'').trim()).filter(Boolean).slice(0,500);
    if(!lines.length) throw new BadRequestException('No lessons or topics could be extracted.');
    const lessons:{title:string;topics:string[]}[]=[];
    for(const line of lines) {
      const lesson=/^(?:lesson|unit|chapter)\s*\d*\s*[:.\-]?\s*(.+)$/i.exec(line);
      if(lesson) lessons.push({title:lesson[1],topics:[]});
      else if(lessons.length) lessons[lessons.length-1].topics.push(line);
      else lessons.push({title:line,topics:[]});
    }
    return lessons.filter(x=>x.topics.length).map(x=>({title:x.title,topics:x.topics.slice(0,100)})).slice(0,100);
  }
  async upload(user:any,raw:any,file:any) {
    const scope=await this.authorized(user,{schoolId:raw.schoolId,academicYearId:raw.academicYearId,classId:raw.classId,subjectId:raw.subjectId,termId:raw.termId});
    if(!file?.buffer || file.size<1 || file.size>10*1024*1024) throw new BadRequestException('File must be between 1 byte and 10 MB.');
    const allowed=['text/plain','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if(!allowed.includes(file.mimetype)) throw new BadRequestException('Only TXT, PDF and DOCX files are supported.');
    if(file.mimetype==='application/pdf' && file.buffer.subarray(0,5).toString()!=='%PDF-') throw new BadRequestException('Invalid PDF file.');
    if(file.mimetype.includes('wordprocessingml') && file.buffer.subarray(0,2).toString()!=='PK') throw new BadRequestException('Invalid DOCX file.');
    let lessons;
    try {lessons=await this.extract(file);} catch(error) {if(error instanceof BadRequestException) throw error;throw new BadRequestException('File could not be read.');}
    const previous=await this.prisma.syllabus.findFirst({where:scope,orderBy:{version:'desc'}});
    if(previous?.status==='DRAFT') throw new ConflictException('Review or discard the existing draft before uploading again.');
    if(previous?.status==='APPROVED' && raw.replacesSyllabusId!==previous.id) throw new ConflictException('Specify the current approved syllabus ID to create a replacement version.');
    const hash=createHash('sha256').update(file.buffer).digest('hex');
    if(await this.prisma.syllabus.findFirst({where:{...scope,fileHash:hash}})) throw new ConflictException('This syllabus file has already been uploaded.');
    const directory=join(process.env.PRIVATE_UPLOAD_DIR||join(process.cwd(),'private-uploads'),'syllabi',scope.schoolId);
    await mkdir(directory,{recursive:true});
    const storageKey=join(directory,randomUUID());
    await writeFile(storageKey,file.buffer,{flag:'wx'});
    const created=await this.prisma.syllabus.create({data:{...scope,version:(previous?.version||0)+1,storageKey,fileName:String(file.originalname||'syllabus').slice(0,255),fileHash:hash,uploadedById:user.id,extractionWarning:'Extraction is provisional. Review and edit all lessons and topics before approval.'}});
    if(lessons.length) await this.saveLessons(created,lessons);
    return this.getAuthorized(user,created.id);
  }
  async list(user:any,value:unknown) {const scope=await this.authorized(user,value);return this.prisma.syllabus.findMany({where:scope,select:{id:true,version:true,status:true,fileName:true,createdAt:true,approvedAt:true},orderBy:{version:'desc'}});}
  private async getAuthorized(user:any,id:string) {const syllabus=await this.prisma.syllabus.findFirst({where:{id,schoolId:user.schoolId},include:{lessons:{include:{topics:{orderBy:{sortOrder:'asc'}}},orderBy:{sortOrder:'asc'}}}});if(!syllabus)throw new NotFoundException('Syllabus not found.');await this.authorized(user,{schoolId:syllabus.schoolId,academicYearId:syllabus.academicYearId,classId:syllabus.classId,subjectId:syllabus.subjectId,termId:syllabus.termId});return syllabus;}
  get(user:any,id:string){return this.getAuthorized(user,id);}
  async review(user:any,id:string,value:unknown) {
    const syllabus=await this.getAuthorized(user,id);
    if(syllabus.status!=='DRAFT') throw new ConflictException('Only draft syllabi can be edited.');
    const parsed=lessonListSchema.safeParse((value as any)?.lessons);
    if(!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const lessons=parsed.data;
    await this.saveLessons(syllabus,lessons);
    await this.prisma.syllabus.update({where:{id},data:{reviewedAt:new Date()} as any});
    return this.getAuthorized(user,id);
  }
  private async saveLessons(syllabus:any,lessons:{title:string;topics:string[]}[]) {
    const id=syllabus.id;
    await this.prisma.$transaction(async tx=>{
      await tx.syllabusTopic.deleteMany({where:{syllabusId:id,schoolId:syllabus.schoolId}});
      await tx.syllabusLesson.deleteMany({where:{syllabusId:id,schoolId:syllabus.schoolId}});
      for(const [index,lesson] of lessons.entries()) await tx.syllabusLesson.create({data:{schoolId:syllabus.schoolId,academicYearId:syllabus.academicYearId,classId:syllabus.classId,subjectId:syllabus.subjectId,termId:syllabus.termId,syllabusId:id,title:lesson.title,sortOrder:index+1,topics:{create:lesson.topics.map((title,position)=>({schoolId:syllabus.schoolId,academicYearId:syllabus.academicYearId,classId:syllabus.classId,subjectId:syllabus.subjectId,termId:syllabus.termId,syllabusId:id,title,sortOrder:position+1}))}}});
    });
  }
  async approve(user:any,id:string) {
    const syllabus=await this.getAuthorized(user,id);
    if(syllabus.status!=='DRAFT') throw new ConflictException('Only draft syllabi can be approved.');
    if(!(syllabus as any).reviewedAt || !syllabus.lessons.length || syllabus.lessons.some(l=>!l.topics.length)) throw new BadRequestException('Review and save at least one lesson with topics before approval.');
    const previous=await this.prisma.syllabus.findFirst({where:{schoolId:syllabus.schoolId,academicYearId:syllabus.academicYearId,classId:syllabus.classId,subjectId:syllabus.subjectId,termId:syllabus.termId,status:'APPROVED'}});
    await this.prisma.$transaction(async tx=>{if(previous)await tx.syllabus.update({where:{id:previous.id},data:{status:'SUPERSEDED',supersededById:id}});await tx.syllabus.update({where:{id},data:{status:'APPROVED',approvedById:user.id,approvedAt:new Date()}});});
    return this.getAuthorized(user,id);
  }
  async discard(user:any,id:string) {
    const syllabus=await this.getAuthorized(user,id);
    if(syllabus.status!=='DRAFT') throw new ConflictException('Only drafts can be discarded.');
    await this.prisma.$transaction(async tx=>{await tx.syllabusTopic.deleteMany({where:{schoolId:syllabus.schoolId,syllabusId:id}});await tx.syllabusLesson.deleteMany({where:{schoolId:syllabus.schoolId,syllabusId:id}});await tx.syllabus.delete({where:{id}});});
    await unlink(syllabus.storageKey).catch(()=>undefined);
    return {discarded:true};
  }
  async topics(user:any,value:unknown) {const scope=await this.authorized(user,value);const approved=await this.prisma.syllabus.findFirst({where:{...scope,status:'APPROVED'}});if(!approved)return [];return this.prisma.syllabusTopic.findMany({where:{...scope,syllabusId:approved.id},include:{lesson:{select:{title:true,sortOrder:true}}},orderBy:[{lesson:{sortOrder:'asc'}},{sortOrder:'asc'}]});}
}
