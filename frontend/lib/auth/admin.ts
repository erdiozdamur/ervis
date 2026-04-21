import type { UserRole } from '@prisma/client';

export function isAdminRole(role?: UserRole | null) {
  if (!role) {
    return false;
  }

  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}
