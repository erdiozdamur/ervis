import { prisma } from '@/db/prisma';
import { Prisma } from '@prisma/client';

type AdminAuditInput = {
  actorId: string;
  action: string;
  resourceType: string;
  resourceKey: string;
  beforeJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null;
  afterJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null;
  request: Request;
};


function normalizeAuditJson(
  value: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null | undefined,
) {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value;
}

function extractIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    const first = forwardedFor
      .split(',')
      .map((part) => part.trim())
      .find(Boolean);

    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get('x-real-ip');
  return realIp?.trim() || null;
}

export async function createAdminAuditLog(input: AdminAuditInput) {
  const ip = extractIp(input.request);
  const userAgent = input.request.headers.get('user-agent')?.trim() || null;

  return prisma.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceKey: input.resourceKey,
      beforeJson: normalizeAuditJson(input.beforeJson),
      afterJson: normalizeAuditJson(input.afterJson),
      ip,
      userAgent,
    },
  });
}
