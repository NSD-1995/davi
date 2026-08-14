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

export class CreateSchoolProfileOptionDto {
  key!: string;
  label!: string;
  type?: string;
  description?: string;
  isRequired?: boolean;
  isActive?: boolean;
}

export class UpdateSchoolProfileOptionDto {
  key?: string;
  label?: string;
  type?: string;
  description?: string;
  isRequired?: boolean;
  isActive?: boolean;
}

export class AddUserProfileOptionDto {
  optionId?: string;
  key?: string;
  value?: string;
}
