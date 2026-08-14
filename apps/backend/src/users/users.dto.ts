export class CreateUserDto {
  schoolId?: string;
  email!: string;
  passwordHash!: string;
  firstName!: string;
  lastName!: string;
  phone?: string;
  avatarUrl?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export class UpdateUserDto {
  schoolId?: string;
  email?: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export class AssignRoleDto {
  roleId?: string;
  roleName?: string;
}
