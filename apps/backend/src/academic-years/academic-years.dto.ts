export class CreateAcademicYearDto {
  name!: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  status?: string;
}

export class AssignAcademicYearSubjectsDto {
  schoolId!: string;
  subjectIds!: string[];
}

export class UpdateAcademicYearDto {
  name?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  status?: string;
}
