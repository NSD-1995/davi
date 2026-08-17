export class CreateRoleDto {
  name!: string;
  code!: string;
  description?: string;
}

export class UpdateRoleDto {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

export class UpdateRolePermissionsDto { permissionIds!: string[]; }
