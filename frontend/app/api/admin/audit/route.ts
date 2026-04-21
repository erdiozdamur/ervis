import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { requireAdminApiAccess } from '@/lib/auth/admin';

export async function GET() {
  const auth = await requireAdminApiAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      actorUser: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
  });

  return NextResponse.json({ ok: true, logs });
}
