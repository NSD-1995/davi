export class CreateSectionDto {
  classId!: string;
  name!: string;
  capacity?: number;
  status?: string;
}

export class UpdateSectionDto {
  name?: string;
  capacity?: number;
  status?: string;
}
