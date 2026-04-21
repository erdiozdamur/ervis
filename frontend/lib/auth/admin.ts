import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/db/prisma';
import { authOptions } from '@/lib/auth/options';

export const ADMIN_PANEL_ROLES: readonly Role[] = [Role.OWNER, Role.ADMIN];

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS?.split(',') ?? ['e.ozdamur@gmail.com'])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

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

export async function requireAdminApiAccess() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 }),
    };
  }

  const hasRoleAccess = await canAccessAdminPanel(session.user.id);
  const hasEmailAccess = isAdminEmail(session.user.email);

  if (!hasRoleAccess && !hasEmailAccess) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: 'Bu işlem için admin yetkisi gerekli.' }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
    },
  };
}
