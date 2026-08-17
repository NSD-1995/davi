export type SubjectStatus = 'ACTIVE' | 'INACTIVE';
export type SubjectType = 'CORE' | 'ELECTIVE' | 'OPTIONAL';

export class CreateSubjectDto {
  schoolId!: string;
  name!: string;
  code!: string;
  description?: string;
  type?: SubjectType;
  status?: SubjectStatus;
}

export class UpdateSubjectDto {
  name?: string;
  code?: string;
  description?: string;
  type?: SubjectType;
  status?: SubjectStatus;
}
