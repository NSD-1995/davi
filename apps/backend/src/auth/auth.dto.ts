export class RegisterDto {
  schoolId!: string;
  email!: string;
  password!: string;
  firstName!: string;
  lastName!: string;
  phone?: string;
  avatarUrl?: string;
  roles?: string[];
}

export class LoginDto {
  email!: string;
  password!: string;
}
