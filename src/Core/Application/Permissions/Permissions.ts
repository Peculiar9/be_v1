import { UserRole } from "../Enums/UserRole";

export enum Permission {
  USER_READ = "user:read",
  USER_WRITE = "user:write",
  FILE_UPLOAD = "file:upload",
  ADMIN_ACCESS = "admin:access",
}

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.USER_READ,
    Permission.USER_WRITE,
    Permission.FILE_UPLOAD,
    Permission.ADMIN_ACCESS,
  ],
  [UserRole.USER]: [
    Permission.USER_READ,
    Permission.FILE_UPLOAD,
  ],
  [UserRole.OPERATOR]: [
    Permission.USER_READ,
    Permission.USER_WRITE,
    Permission.FILE_UPLOAD,
  ],
  [UserRole.INSTALLER]: [
    Permission.USER_READ,
    Permission.FILE_UPLOAD,
  ],
  [UserRole.DEALER]: [
    Permission.USER_READ,
  ],
};

export function permissionsForRoles(roles: readonly string[] = []): Set<Permission> {
  const permissions = new Set<Permission>();

  for (const role of roles) {
    const mappedPermissions = ROLE_PERMISSIONS[role as UserRole] ?? [];
    for (const permission of mappedPermissions) {
      permissions.add(permission);
    }
  }

  return permissions;
}

export function hasRole(roles: readonly string[] = [], requiredRoles: readonly UserRole[]): boolean {
  return requiredRoles.some(role => roles.includes(role));
}

export function hasPermission(roles: readonly string[] = [], permission: Permission): boolean {
  return permissionsForRoles(roles).has(permission);
}

export function hasAnyPermission(roles: readonly string[] = [], permissions: readonly Permission[]): boolean {
  const granted = permissionsForRoles(roles);
  return permissions.some(permission => granted.has(permission));
}
