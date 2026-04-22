import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getJsonBody, getSearchParamsObject } from '@/lib/api/validation';
import { createAdminAuditLog } from '@/lib/auth/admin-audit';
import { isAdminRole, requireSuperAdmin } from '@/lib/auth/admin';

const updateStatusParamsSchema = z.object({
  userId: z.string().trim().min(1),
});

const updateStatusBodySchema = z.object({
  isActive: z.boolean(),
});

const updateStatusQuerySchema = z.object({
  reason: z.string().trim().min(1).max(255).optional(),
});

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function PUT(request: Request, context: RouteContext) {
  const guard = await requireSuperAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const parsedParams = updateStatusParamsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { message: 'Geçersiz kullanıcı kimliği.', issues: parsedParams.error.flatten() },
      { status: 400 },
    );
  }

  const parsedQuery = updateStatusQuerySchema.safeParse(getSearchParamsObject(request));

  if (!parsedQuery.success) {
    return NextResponse.json(
      { message: 'Geçersiz sorgu parametreleri.', issues: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const parsedBody = updateStatusBodySchema.safeParse(await getJsonBody(request));

  if (!parsedBody.success) {
    return NextResponse.json(
      { message: 'Geçersiz istek gövdesi.', issues: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: parsedParams.data.userId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!target) {
    return NextResponse.json({ message: 'Kullanıcı bulunamadı.' }, { status: 404 });
  }

  if (target.id === guard.user.id && target.isActive !== parsedBody.data.isActive) {
    return NextResponse.json({ message: 'Kendi hesabını pasife alamazsın.' }, { status: 409 });
  }

  if (target.isActive && !parsedBody.data.isActive && isAdminRole(target.role)) {
    const activeAdminCount = await prisma.user.count({
      where: {
        isActive: true,
        role: {
          in: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
        },
      },
    });

    if (activeAdminCount <= 1) {
      return NextResponse.json({ message: 'Sistemde en az bir aktif admin kalmalı.' }, { status: 409 });
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: target.id },
    data: { isActive: parsedBody.data.isActive },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  await createAdminAuditLog({
    actorId: guard.user.id,
    action: 'user.status.updated',
    resourceType: 'user',
    resourceKey: target.id,
    beforeJson: { isActive: target.isActive },
    afterJson: {
      isActive: updatedUser.isActive,
      reason: parsedQuery.data.reason ?? null,
    },
    request,
  });

  return NextResponse.json({ ok: true, user: updatedUser }, { status: 200 });
}
