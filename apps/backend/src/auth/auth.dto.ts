export class RegisterDto {
  schoolId?: string;
  email!: string;
  password!: string;
  firstName!: string;
  lastName!: string;
  phone?: string;
  avatarUrl?: string;
  roles?: string[];
  mustChangePassword?: boolean;
}

export class LoginDto {
  email?: string;
  username?: string;
  password!: string;
}

export class ChangePasswordDto {
  currentPassword!: string;
  newPassword!: string;
}
