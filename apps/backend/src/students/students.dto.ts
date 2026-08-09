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
