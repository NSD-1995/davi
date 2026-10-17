export class CreateStaffDto {
  staffCategoryId?:string|null;
  staffCategory?: 'TEACHING' | 'NON_TEACHING' | 'ADMIN';
  firstName!: string; lastName?: string; mobile!: string; email?: string;
  employeeId!: string; joiningDate?: string; roleId!: string;
}
export class UpdateStaffDto {
  staffCategoryId?:string|null;
  staffCategory?: 'TEACHING' | 'NON_TEACHING' | 'ADMIN';
  firstName?: string; lastName?: string; email?: string; employeeId?: string;
  joiningDate?: string; roleId?: string; status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
