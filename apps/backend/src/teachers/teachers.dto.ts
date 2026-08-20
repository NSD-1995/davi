export class CreateTeacherDto {
  userId!: string;
  schoolId!: string;
  teacherCode!: string;
  specialization?: string;
  qualification?: string;
  hireDate?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
}

export class UpdateTeacherDto {
  userId?: string;
  schoolId?: string;
  teacherCode?: string;
  specialization?: string;
  qualification?: string;
  hireDate?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
}

export class CreateTeacherAssignmentDto {
  academicYearId!: string;
  classId!: string;
  sectionId?: string;
  subjectId?: string;
  isClassTeacher?: boolean;
}
