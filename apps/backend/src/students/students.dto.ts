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
  academicYearId?: string;
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
  address?: string | null;
  admissionDate?: string | null;
  version?: number;
  reason?: string;
  classId?: string;
  sectionId?: string | null;
  rollNumber?: string;
  status?: 'ACTIVE' | 'TRANSFERRED' | 'PROMOTED' | 'WITHDRAWN';
}
