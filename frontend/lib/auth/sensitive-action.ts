import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { isSuperAdminRole } from '@/lib/auth/admin';

export const CONFIRM_TOKEN = 'ONAYLA';

export const sensitiveActionSchema = z.object({
  reason: z.string().trim().min(10).max(255),
  confirm: z.string().trim().toUpperCase().refine((value) => value === CONFIRM_TOKEN, {
    message: `Onay metni ${CONFIRM_TOKEN} olmalı.`,
  }),
  fourEyesApproverEmail: z.string().trim().email().max(191).optional().or(z.literal('')),
});

export async function resolveOptionalFourEyesApproval(actorId: string, approverEmail?: string) {
  if (!approverEmail || approverEmail.trim().length === 0) {
    return { approverId: null, approverEmail: null };
  }

  const normalizedEmail = approverEmail.trim().toLowerCase();

  const approver = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!approver || !approver.isActive || !isSuperAdminRole(approver.role)) {
    throw new Error('4-eyes onayı için aktif bir SUPER_ADMIN/OWNER e-posta adresi girilmelidir.');
  }

  if (approver.id === actorId) {
    throw new Error('4-eyes onayında onaylayan kullanıcı işlemi yapan kişiyle aynı olamaz.');
  }

  return {
    approverId: approver.id,
    approverEmail: approver.email,
  };
}
