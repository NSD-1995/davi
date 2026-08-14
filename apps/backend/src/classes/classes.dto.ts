export type SchoolClassStatus = 'ACTIVE' | 'INACTIVE';

export class CreateSchoolClassDto {
  academicYearId!: string;
  name!: string;
  code?: string;
  capacity?: number;
  status?: SchoolClassStatus;
  numberOfSections?: number;
  sectionCapacity?: number;
}

export class CreateClassesBulkDto {
  academicYearId!: string;
  numberOfSections!: number;
  sectionCapacity?: number;
  montessori?: boolean;
  primary?: boolean;
  secondary?: boolean;
  seniorSecondary?: boolean;
}

export class UpdateSchoolClassDto {
  academicYearId?: string;
  name?: string;
  code?: string;
  capacity?: number;
  status?: SchoolClassStatus;
}
