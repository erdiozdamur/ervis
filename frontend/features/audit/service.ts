import { AuditAction } from '@prisma/client';
import { prisma } from '@/db/client';

export async function createAuditLog(input: {
  actorId: string;
  organizationId?: string;
  action: AuditAction;
  subjectType: string;
  subjectId: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      organizationId: input.organizationId,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      metadata: input.metadata ?? {},
    },
  });
}
