import { Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';

type AdminAuditLogInput = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  beforeState?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  afterState?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

export async function writeAdminAuditLog(input: AdminAuditLogInput) {
  await prisma.adminAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      metadata: input.metadata,
    },
  });
}
