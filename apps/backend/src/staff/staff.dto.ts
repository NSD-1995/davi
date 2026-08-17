export class CreateStaffDto {
  firstName!: string; lastName?: string; mobile!: string; email?: string;
  employeeId!: string; joiningDate?: string; roleId!: string;
}
export class UpdateStaffDto {
  firstName?: string; lastName?: string; email?: string; employeeId?: string;
  joiningDate?: string; roleId?: string; status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
