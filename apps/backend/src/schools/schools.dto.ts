export class CreateSchoolDto {
  name!: string;
  shortName?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  adminEmail!: string;
  adminFirstName?: string;
  adminLastName?: string;
}

export class UpdateSchoolDto {
  name?: string;
  shortName?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  adminEmail?: string;
  adminFirstName?: string;
  adminLastName?: string;
}
