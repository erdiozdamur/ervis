import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { requireAdminApiAccess } from '@/lib/auth/admin';
import { writeAdminAuditLog } from '@/lib/admin-audit';

export async function GET() {
  const auth = await requireAdminApiAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, users });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApiAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as { userId?: string; role?: UserRole } | null;

  if (!body?.userId || !body.role || !Object.values(UserRole).includes(body.role)) {
    return NextResponse.json({ message: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, role: true },
  });

  if (!existing) {
    return NextResponse.json({ message: 'Kullanıcı bulunamadı.' }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data: { role: body.role },
    select: { id: true, role: true },
  });

  await writeAdminAuditLog({
    actorUserId: auth.user.id,
    action: 'admin.users.role.update',
    targetType: 'User',
    targetId: updated.id,
    beforeState: { role: existing.role },
    afterState: { role: updated.role },
  });

  return NextResponse.json({ ok: true, user: updated });
}
