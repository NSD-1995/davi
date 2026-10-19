export type SchoolClassStatus = 'ACTIVE' | 'INACTIVE';

export class CreateSchoolClassDto {
  academicYearId!: string;
  name!: string;
  academicGroup?: string;
  code?: string;
  capacity?: number;
  status?: SchoolClassStatus;
  numberOfSections?: number;
  sectionCapacity?: number;
  subjectIds?: string[];
}

export class ReplaceClassSubjectsDto {
  subjectIds!: string[];
}

export class CreateClassesBulkDto {
  academicYearId!: string;
  numberOfSections?: number;
  sectionCapacity?: number;
  montessori?: boolean;
  prePrimary?: boolean;
  primary?: boolean;
  middle?: boolean;
  secondary?: boolean;
  seniorSecondary?: boolean;
}

export class UpdateSchoolClassDto {
  academicYearId?: string;
  name?: string;
  academicGroup?: string;
  code?: string;
  capacity?: number;
  status?: SchoolClassStatus;
}
