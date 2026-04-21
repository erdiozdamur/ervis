import { Role } from '@prisma/client';
import { prisma } from '@/db/prisma';

export const ADMIN_PANEL_ROLES: readonly Role[] = [Role.OWNER, Role.ADMIN];

export async function hasRole(userId: string, role: Role) {
  const membership = await prisma.userRole.findUnique({
    where: {
      userId_role: {
        userId,
        role,
      },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function hasAnyRole(userId: string, roles: readonly Role[]) {
  if (roles.length === 0) {
    return false;
  }

  const membership = await prisma.userRole.findFirst({
    where: {
      userId,
      role: {
        in: [...roles],
      },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function canAccessAdminPanel(userId: string) {
  return hasAnyRole(userId, ADMIN_PANEL_ROLES);
}
