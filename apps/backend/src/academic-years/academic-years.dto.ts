export class CreateAcademicYearDto {
  name!: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  status?: string;
}

export class UpdateAcademicYearDto {
  name?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  status?: string;
}
