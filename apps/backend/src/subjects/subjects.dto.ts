export class CreateSubjectDto {
  schoolId!: string;
  name!: string;
  code?: string;
  description?: string;
  type?: string;
  status?: string;
}

export class UpdateSubjectDto {
  name?: string;
  code?: string;
  description?: string;
  type?: string;
  status?: string;
}
