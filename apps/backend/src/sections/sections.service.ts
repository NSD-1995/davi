import { sectionRollNumberPreview } from './roll-number-rules';
import { admissionsTransaction } from '../student-admissions/admissions-transaction';
import { z } from 'zod';
import { parse, id } from '../student-admissions/admissions-rules';
import { Prisma } from '@prisma/client';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto, UpdateSectionDto } from './sections.dto';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async rollNumbers(schoolId:string|null,actorId:string,sectionId:string,body:unknown,commit=false){
    this.requireSchoolId(schoolId);
    const data=parse(z.object({academicYearId:id,expectedPreview:z.string().length(64).optional()}).strict(),body);
    return admissionsTransaction(this.prisma,async tx=>{
      const roles=await tx.userRole.findMany({where:{schoolId,userId:actorId,user:{status:'ACTIVE'},role:{schoolId,isActive:true}},include:{role:{include:{rolePermissions:{include:{permission:true}}}}}});
      const permission=commit?'STUDENT_UPDATE':'STUDENT_VIEW';if(!roles.some((r:any)=>r.role.code==='SCHOOL_ADMIN'||r.role.rolePermissions.some((p:any)=>p.permission.code===permission)))throw new ForbiddenException('Missing active school permission: '+permission);
      const section=await tx.section.findFirst({where:{id:sectionId,schoolId,status:'ACTIVE',schoolClass:{academicYearId:data.academicYearId}},include:{schoolClass:true}});if(!section)throw new NotFoundException('Section not found in the selected school and academic year.');
      if(commit)await tx.section.update({where:{id:sectionId},data:{updatedAt:new Date()}});
      const students=await tx.studentEnrollment.findMany({where:{schoolId,academicYearId:data.academicYearId,classId:section.classId,sectionId},include:{student:{include:{user:{select:{firstName:true,lastName:true}}}}}});
      const preview=sectionRollNumberPreview(students.filter((r:any)=>r.status==='ACTIVE'),students.filter((r:any)=>r.status!=='ACTIVE'));
      if(!commit)return {...preview,sectionName:section.name};
      if(preview.errors.length)throw new BadRequestException(preview.errors.join(' '));
      if(!data.expectedPreview||data.expectedPreview!==preview.expectedPreview)throw new ConflictException('Student roster changed. Preview roll numbers again.');
      for(const row of preview.rows.filter(r=>r.changed))await tx.studentEnrollment.update({where:{id:row.enrollmentId},data:{rollNumber:row.proposed,version:{increment:1}}});
      if(preview.changed)await tx.auditLog.create({data:{schoolId,actorId,method:'POST',path:'/sections/'+sectionId+'/roll-numbers/generate',action:'SECTION_ROLL_NUMBERS_GENERATED',entityType:'Section',entityId:sectionId,metadata:{academicYearId:data.academicYearId,classId:section.classId,rows:preview.rows.filter(r=>r.changed).map(r=>({enrollmentId:r.enrollmentId,before:r.current,after:r.proposed}))}}});
      return {updated:preview.changed};
    });
  }

  findAll(schoolId: string | null) {
    this.requireSchoolId(schoolId);
    return this.prisma.section.findMany({
      where: { schoolId },
      include: { school: true, schoolClass: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchoolId(schoolId);
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { school: true, schoolClass: true },
    });

    if (!section) {
      throw new NotFoundException(`Section with id ${id} not found`);
    }
    this.assertSchoolAccess(section.schoolId, schoolId);

    return section;
  }

  findBySchool(schoolId: string, actorSchoolId: string | null) {
    this.requireSchoolId(actorSchoolId);
    this.assertSchoolAccess(schoolId, actorSchoolId);
    return this.prisma.section.findMany({
      where: { schoolId },
      include: { school: true, schoolClass: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByClass(classId: string, schoolId: string | null) {
    this.requireSchoolId(schoolId);
    const schoolClass = await this.prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!schoolClass) throw new NotFoundException(`Class with id ${classId} not found`);
    this.assertSchoolAccess(schoolClass.schoolId, schoolId);
    return this.prisma.section.findMany({
      where: { classId },
      include: { school: true, schoolClass: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(schoolId: string | null, data: CreateSectionDto) {
    this.requireSchoolId(schoolId);
    const schoolClass = await this.prisma.schoolClass.findUnique({ where: { id: data.classId } });
    if (!schoolClass) {
      throw new NotFoundException(`Class with id ${data.classId} not found`);
    }
    this.assertSchoolAccess(schoolClass.schoolId, schoolId);
    if (schoolClass.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot create a section for an inactive class. Reactivate the class first.');
    }

    return this.prisma.section.create({
      data: {
        schoolId,
        classId: data.classId,
        name: data.name,
        capacity: data.capacity ?? null,
        status: data.status ?? 'ACTIVE',
      },
      include: { school: true, schoolClass: true },
    });
  }

  async update(id: string, schoolId: string | null, data: UpdateSectionDto) {
    await this.findOne(id, schoolId);

    return this.prisma.section.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { school: true, schoolClass: true },
    });
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);

    try { return await this.prisma.$transaction(async tx => {
      const [students,timetables] = await Promise.all([
        tx.studentEnrollment.count({where:{sectionId:id,schoolId:schoolId!}}),
        tx.timetableEntry.count({where:{sectionId:id,schoolId:schoolId!}}),
      ]);
      if(students||timetables) throw new ConflictException('Section has '+students+' student enrollment(s) and '+timetables+' timetable entry/entries. Move or remove those records first, or set the section status to INACTIVE.');
      await tx.teacherAcademicAssignment.deleteMany({where:{sectionId:id,schoolId:schoolId!}});
      await tx.periodTemplateAssignment.deleteMany({where:{sectionId:id,schoolId:schoolId!}});
      return tx.section.delete({where:{id}});
    }); }
    catch(error) {
      if((error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2003') || (error instanceof Prisma.PrismaClientUnknownRequestError && /violates RESTRICT setting of foreign key constraint|violates foreign key constraint/.test(error.message))) throw new ConflictException('Section is linked to students, subject or teacher assignments, timetables, or other academic records. Remove those links first or set its status to INACTIVE.');
      throw error;
    }
  }

  private requireSchoolId(schoolId: string | null): asserts schoolId is string {
    if (!schoolId) throw new ForbiddenException('A school-admin account must be assigned to a school.');
  }

  private assertSchoolAccess(resourceSchoolId: string, actorSchoolId: string) {
    if (resourceSchoolId !== actorSchoolId) {
      throw new ForbiddenException('You can only access sections for your own school.');
    }
  }
}
