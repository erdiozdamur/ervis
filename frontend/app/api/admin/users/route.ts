import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Role } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { authOptions } from '@/lib/auth/options';
import { hasAnyRole } from '@/lib/auth/admin';

const ADMIN_ROLES = [Role.OWNER, Role.ADMIN] as const;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const canManageUsers = await hasAnyRole(session.user.id, ADMIN_ROLES);

  if (!canManageUsers) {
    return NextResponse.json({ ok: false, message: 'Bu işlem için yetkin yok.' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      roles: {
        select: {
          role: true,
        },
        orderBy: {
          role: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
  });

  return NextResponse.json({ ok: true, users }, { status: 200 });
}
