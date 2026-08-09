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
