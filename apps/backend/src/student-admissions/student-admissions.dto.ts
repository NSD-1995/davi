export class AdmissionStudentDto { admissionNumber!: string; firstName!: string; lastName!: string; dateOfBirth?: string; gender?: 'MALE' | 'FEMALE' | 'OTHER'; }
export class AdmissionEnrollmentDto { academicYearId!: string; classId!: string; sectionId?: string; rollNumber?: string; }
export class AdmissionParentDto { firstName!: string; lastName?: string; mobile!: string; email?: string; relationship?: string; isPrimary!: boolean; }
export class CreateStudentAdmissionDto { student!: AdmissionStudentDto; enrollment!: AdmissionEnrollmentDto; parents!: AdmissionParentDto[]; }
