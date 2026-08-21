export class CreateStudentDto {
  userId!: string;
  schoolId!: string;
  studentCode!: string;
  admissionNumber?: string;
  gradeLevel?: string;
  birthDate?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED';
}

export class UpdateStudentDto {
  userId?: string;
  schoolId?: string;
  studentCode?: string;
  admissionNumber?: string;
  gradeLevel?: string;
  birthDate?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED';
}

export class EnrollStudentDto {
  academicYearId!: string;
  classId!: string;
  sectionId?: string;
  rollNumber?: string;
}

export class UpdateStudentEnrollmentDto {
  classId?: string;
  sectionId?: string | null;
  rollNumber?: string;
  status?: 'ACTIVE' | 'TRANSFERRED' | 'PROMOTED' | 'WITHDRAWN';
}
