import { getServerSession } from 'next-auth';
import type { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth/options';

export function isAdminRole(role?: UserRole | null) {
  if (!role) {
    return false;
  }

  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isSuperAdminRole(role?: UserRole | null) {
  return role === 'SUPER_ADMIN';
}

type GuardSuccess = {
  ok: true;
  user: {
    id: string;
    role: UserRole;
  };
};

type GuardFailure = {
  ok: false;
  response: NextResponse;
};

type GuardResult = GuardSuccess | GuardFailure;

export async function requireAdmin(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 }),
    };
  }

  if (!isAdminRole(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ message: 'Yetersiz yetki.' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    user: {
      id: session.user.id,
      role: session.user.role,
    },
  };
}

export async function requireSuperAdmin(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 }),
    };
  }

  if (!isSuperAdminRole(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ message: 'Yetersiz yetki.' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    user: {
      id: session.user.id,
      role: session.user.role,
    },
  };
}
