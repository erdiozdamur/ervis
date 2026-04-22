import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getJsonBody } from '@/lib/api/validation';
import { createAdminAuditLog } from '@/lib/auth/admin-audit';
import { isAdminRole, requireSuperAdmin } from '@/lib/auth/admin';
import { getSupportedPrivilegedRoles } from '@/lib/auth/admin-role-compat';
import { resolveOptionalFourEyesApproval, sensitiveActionSchema } from '@/lib/auth/sensitive-action';

const updateRoleParamsSchema = z.object({
  userId: z.string().trim().min(1),
});

const updateRoleBodySchema = z.object({
  role: z.nativeEnum(UserRole),
}).and(sensitiveActionSchema);

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

  const parsedParams = updateRoleParamsSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { message: 'Geçersiz kullanıcı kimliği.', issues: parsedParams.error.flatten() },
      { status: 400 },
    );
  }


  const parsedBody = updateRoleBodySchema.safeParse(await getJsonBody(request));

  if (!parsedBody.success) {
    return NextResponse.json(
      { message: 'Geçersiz istek gövdesi.', issues: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: {
      id: parsedParams.data.userId,
    },
    select: {
      id: true,
      role: true,
      email: true,
      isActive: true,
    },
  });

  if (!target) {
    return NextResponse.json({ message: 'Kullanıcı bulunamadı.' }, { status: 404 });
  }

  if (target.id === guard.user.id && target.role !== parsedBody.data.role) {
    return NextResponse.json({ message: 'Kendi rolünü düşüremezsin.' }, { status: 409 });
  }

  const targetIsAdmin = isAdminRole(target.role);
  const privilegedRoles = await getSupportedPrivilegedRoles();
  const nextIsAdmin = isAdminRole(parsedBody.data.role);

  if (targetIsAdmin && !nextIsAdmin && target.isActive) {
    const activeAdminCount = await prisma.user.count({
      where: {
        isActive: true,
        role: {
          in: privilegedRoles,
        },
      },
    });

    if (activeAdminCount <= 1) {
      return NextResponse.json({ message: 'Sistemde en az bir aktif admin kalmalı.' }, { status: 409 });
    }
  }


  let fourEyesApproval: { approverId: string | null; approverEmail: string | null };

  try {
    fourEyesApproval = await resolveOptionalFourEyesApproval(guard.user.id, parsedBody.data.fourEyesApproverEmail);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '4-eyes doğrulaması başarısız oldu.' },
      { status: 400 },
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: target.id },
    data: { role: parsedBody.data.role },
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
    action: 'user.role.updated',
    resourceType: 'user',
    resourceKey: target.id,
    beforeJson: { role: target.role },
    afterJson: {
      role: updatedUser.role,
      reason: parsedBody.data.reason,
      fourEyesApprovedBy: fourEyesApproval.approverEmail,
    },
    request,
  });

  return NextResponse.json({ ok: true, user: updatedUser }, { status: 200 });
}
