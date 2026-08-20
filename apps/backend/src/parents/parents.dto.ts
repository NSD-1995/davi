export class CreateParentDto {
  userId!: string;
  schoolId!: string;
  parentCode!: string;
  occupation?: string;
  relationshipToStudent?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export class UpdateParentDto {
  userId?: string;
  schoolId?: string;
  parentCode?: string;
  occupation?: string;
  relationshipToStudent?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export class OnboardParentDto {
  firstName!: string;
  lastName?: string;
  mobile!: string;
  email?: string;
  parentCode!: string;
  occupation?: string;
}

export class LinkParentStudentDto {
  studentId!: string;
  relationshipType?: string;
  isPrimary?: boolean;
}
