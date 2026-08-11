export type UserRole =
  | 'teacher'
  | 'admin'
  | 'parent'
  | 'super-admin'
  | 'school-admin';

export interface SchoolUser {
  id: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  mustChangePassword?: boolean;
}
