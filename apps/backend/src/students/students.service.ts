import { assignSectionRoll } from '../sections/assign-roll-number';
import { EnrollmentAllocationService } from '../student-admissions/enrollment-allocation.service';
import { admissionsTransaction } from '../student-admissions/admissions-transaction';
import { parse, id, reason, checkVersion } from '../student-admissions/admissions-rules';
import { z } from 'zod';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto, EnrollStudentDto, UpdateStudentDto, UpdateStudentEnrollmentDto } from './students.dto';

const includeStudent = { user: true, studentParents: { include: { parent: { include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } } } } }, enrollments: { include: { academicYear: true, schoolClass: true, section: true }, orderBy: { createdAt: 'desc' as const } } };
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService, private readonly allocation: EnrollmentAllocationService) {}
  async findAll(schoolId: string | null) { this.requireSchool(schoolId); const students = await this.prisma.student.findMany({ where: { enrollments: { some: { schoolId } } }, include: includeStudent }); return students.map((student) => this.schoolView(student, schoolId)); }
  async findOne(id: string, schoolId: string | null) { this.requireSchool(schoolId); const student = await this.prisma.student.findFirst({ where: { id, enrollments: { some: { schoolId } } }, include: includeStudent }); if (!student) throw new ForbiddenException('You can only access students enrolled in your own school.'); return this.schoolView(student, schoolId); }
  async create(schoolId: string | null, data: CreateStudentDto) { this.requireSchool(schoolId); if (data.schoolId !== schoolId) throw new ForbiddenException('You can only create students for your own school.'); const user = await this.prisma.user.findUnique({ where: { id: data.userId } }); if (!user) throw new NotFoundException('User not found.'); return this.prisma.student.create({ data: { userId: data.userId, studentCode: data.studentCode, gradeLevel: data.gradeLevel, birthDate: data.birthDate ? new Date(data.birthDate) : null, gender: data.gender, status: data.status ?? 'ACTIVE' } }); }
  async update(id: string, schoolId: string | null, data: UpdateStudentDto) { await this.findOne(id, schoolId); this.requireSchool(schoolId); if (data.schoolId !== undefined && data.schoolId !== schoolId) throw new ForbiddenException('A student cannot be moved to another school.'); const { schoolId: _school, academicYearId, admissionNumber, ...studentData } = data; const student = await this.prisma.student.update({ where: { id }, data: { ...studentData, ...(data.birthDate ? { birthDate: new Date(data.birthDate) } : {}) } }); if (admissionNumber !== undefined) { const enrollment = await this.prisma.studentEnrollment.findFirst({ where: { studentId: id, schoolId, ...(academicYearId?{academicYearId}:{status:'ACTIVE'}) }, orderBy: { createdAt: 'desc' } }); if (enrollment) await this.prisma.studentEnrollment.update({ where: { id: enrollment.id }, data: { admissionNumber } }); } return student; }
  async remove(id: string, schoolId: string | null) { await this.findOne(id, schoolId); this.requireSchool(schoolId); return this.prisma.studentEnrollment.updateMany({ where: { studentId: id, schoolId, status: 'ACTIVE' }, data: { status: 'WITHDRAWN' } }); }
  async enroll(studentId: string, schoolId: string | null, data: EnrollStudentDto, actorId: string) {
    this.requireSchool(schoolId); await this.findOne(studentId, schoolId);
    if(await this.prisma.studentEnrollment.findUnique({where:{studentId_schoolId_academicYearId:{studentId,schoolId,academicYearId:data.academicYearId}}}))throw new ConflictException('Student is already enrolled for this academic year and school.');
    const previous = await this.prisma.studentEnrollment.findFirst({where:{studentId,schoolId,status:'ACTIVE'},orderBy:{createdAt:'desc'}});
    if (!previous) throw new BadRequestException('No active enrollment to promote. Use the admissions joining workflow for new students.');
    await this.allocation.promote(schoolId,actorId,{enrollmentIds:[{id:previous.id,version:previous.version}],academicYearId:data.academicYearId,classId:data.classId,sectionId:data.sectionId||null,reason:'Promotion requested from student enrollment.'});
    return this.prisma.studentEnrollment.findUnique({where:{studentId_schoolId_academicYearId:{studentId,schoolId,academicYearId:data.academicYearId}},include:{academicYear:true,schoolClass:true,section:true}});
  }
  async findEnrollments(studentId: string, schoolId: string | null) { this.requireSchool(schoolId); await this.findOne(studentId, schoolId); return this.prisma.studentEnrollment.findMany({ where: { studentId, schoolId }, include: { academicYear: true, schoolClass: true, section: true }, orderBy: { createdAt: 'desc' } }); }
  async updateEnrollment(studentId:string,enrollmentId:string,schoolId:string|null,input:UpdateStudentEnrollmentDto,actorId:string,transaction?:any) {
    this.requireSchool(schoolId); await this.findOne(studentId,schoolId);
    const data=parse(z.object({classId:id.optional(),sectionId:id.nullable().optional(),rollNumber:z.string().max(100).optional(),address:z.string().max(2000).nullable().optional(),admissionDate:z.string().date().nullable().optional(),status:z.enum(['ACTIVE','TRANSFERRED','PROMOTED','WITHDRAWN']).optional(),version:z.number().int().positive().optional(),reason:reason.default('Enrollment details updated.')} ).strict(),input);
    const execute=async (tx:any)=>{
      await this.allocation.permission(tx,schoolId,actorId,'ENROLLMENT_MOVE');
      const before=await tx.studentEnrollment.findFirst({where:{id:enrollmentId,studentId,schoolId}});if(!before)throw new NotFoundException('Enrollment not found.');
      if(data.version!==undefined)checkVersion(before.version,data.version);
      if(data.classId!==undefined||data.sectionId!==undefined) await this.allocation.moveInTransaction(tx,schoolId,actorId,[{enrollmentId,version:before.version,classId:data.classId||before.classId,sectionId:data.sectionId!==undefined?data.sectionId:data.classId!==undefined?null:before.sectionId}],data.reason,'TRANSFER');
      if(data.status==='ACTIVE'&&before.status!=='ACTIVE')throw new BadRequestException('Inactive enrollments cannot be reactivated through a details edit.');
      if(data.status==='PROMOTED'&&before.status!=='PROMOTED')throw new BadRequestException('Use the promotion workflow to create the new academic-year enrollment.');
      if(data.status&&data.status!==before.status)await tx.enrollmentMovement.create({data:{schoolId,enrollmentId,kind:'STATUS_CHANGE',fromClassId:before.classId,fromSectionId:before.sectionId,toClassId:data.classId||before.classId,toSectionId:data.sectionId===undefined?before.sectionId:data.sectionId,reason:data.reason,actorId}});
      const current=await tx.studentEnrollment.findUnique({where:{id:enrollmentId}});const rollNumber=data.rollNumber!==undefined?await assignSectionRoll(tx,schoolId,before.academicYearId,current.sectionId,data.rollNumber,enrollmentId):undefined;
      return tx.studentEnrollment.update({where:{id:enrollmentId},data:{...(data.rollNumber!==undefined?{rollNumber}:{}),...(data.status?{status:data.status}:{}),...(data.address!==undefined?{address:data.address}:{}),...(data.admissionDate!==undefined?{admissionDate:data.admissionDate?new Date(data.admissionDate):null}:{}),version:{increment:1}},include:{academicYear:true,schoolClass:true,section:true}});
    };
    return transaction?execute(transaction):admissionsTransaction(this.prisma,execute);
  }
  async applyMigrationUpdate(tx:any,schoolId:string,actorId:string,enrollmentId:string,values:any){
    await this.allocation.permission(tx,schoolId,actorId,'STUDENT_UPDATE');
    const enrollment=await tx.studentEnrollment.findFirst({where:{id:enrollmentId,schoolId,academicYearId:values.academicYearId,status:'ACTIVE'},include:{student:true}});
    if(!enrollment)throw new NotFoundException('Target enrollment not found.');
    if(await tx.studentEnrollment.count({where:{studentId:enrollment.studentId,schoolId:{not:schoolId}}}))throw new ForbiddenException('This student has another school membership. Review shared identity changes outside migration.');
    await tx.user.update({where:{id:enrollment.student.userId},data:{firstName:values.firstName,lastName:values.lastName || ''}});
    await tx.student.update({where:{id:enrollment.studentId},data:{...(values.dateOfBirth===null?{birthDate:null}:values.dateOfBirth?{birthDate:new Date(values.dateOfBirth)}:{}),...(values.gender===null?{gender:null}:values.gender?{gender:values.gender}: {})}});
    return this.updateEnrollment(enrollment.studentId,enrollmentId,schoolId,{classId:values.classId,sectionId:values.sectionId,version:enrollment.version,reason:values.reason,...(values.address!==undefined?{address:values.address}:{}),...(values.admissionDate!==undefined?{admissionDate:values.admissionDate}:{}),...(values.rollNumber?{rollNumber:values.rollNumber}:{})},actorId,tx);
  }
  private schoolView(student: any, schoolId: string) { if (student.user) student.user.passwordHash = undefined; const enrollments = (student.enrollments ?? []).filter((enrollment: any) => enrollment.schoolId === schoolId); const studentParents = (student.studentParents ?? []).filter((link: any) => link.status === 'ACTIVE'); return { ...student, schoolId, admissionNumber: enrollments[0]?.admissionNumber ?? null, enrollments, studentParents }; }
  private requireSchool(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
}
