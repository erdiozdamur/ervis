import { UserRole } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { authOptions } from '@/lib/auth/options';

const BOOTSTRAP_OWNER_EMAILS = new Set(['e.ozdamur@gmail.com']);
const ADMIN_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return BOOTSTRAP_OWNER_EMAILS.has(email.trim().toLowerCase());
}

export function hasAdminRole(role?: UserRole | null) {
  if (!role) {
    return false;
  }

  return ADMIN_ROLES.includes(role);
}

export function hasAdminAccess(input: { role?: UserRole | null; email?: string | null }) {
  return hasAdminRole(input.role) || isAdminEmail(input.email);
}

export async function requireAdminApiAccess() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true },
  });

  if (!user || !hasAdminAccess(user)) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: 'Bu işlem için admin yetkisi gerekiyor.' }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    user,
  };
}

export async function requireAdminPageAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });

  return hasAdminAccess(user ?? {});
}
