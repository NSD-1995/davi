export type UserRole = 'teacher' | 'admin' | 'parent';
export interface SchoolUser {
  id: string;
  email: string;
  role: UserRole;
}
