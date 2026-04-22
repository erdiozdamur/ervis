import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getJsonBody } from '@/lib/api/validation';
import { createAdminAuditLog } from '@/lib/auth/admin-audit';
import { isAdminRole, requireSuperAdmin } from '@/lib/auth/admin';
import { getSupportedPrivilegedRoles } from '@/lib/auth/admin-role-compat';
import { resolveOptionalFourEyesApproval, sensitiveActionSchema } from '@/lib/auth/sensitive-action';
import { withAdminWriteProtection } from '@/lib/security/admin-write-guard';

const updateStatusParamsSchema = z.object({
  userId: z.string().trim().min(1),
});

const updateStatusBodySchema = z.object({
  isActive: z.boolean(),
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

  return withAdminWriteProtection(request, guard.user.id, async () => {
    const parsedParams = updateStatusParamsSchema.safeParse(context.params);

    if (!parsedParams.success) {
      return NextResponse.json(
        { message: 'Geçersiz kullanıcı kimliği.', issues: parsedParams.error.flatten() },
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

    const privilegedRoles = await getSupportedPrivilegedRoles();

    if (target.id === guard.user.id && target.isActive !== parsedBody.data.isActive) {
      return NextResponse.json({ message: 'Kendi hesabını pasife alamazsın.' }, { status: 409 });
    }

    if (target.isActive && !parsedBody.data.isActive && isAdminRole(target.role)) {
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
      reason: parsedBody.data.reason,
      fourEyesApprovedBy: fourEyesApproval.approverEmail,
    },
    request,
  });

    return NextResponse.json({ ok: true, user: updatedUser }, { status: 200 });
  });
}
