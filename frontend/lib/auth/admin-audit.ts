import { prisma } from '@/db/prisma';
import type { Prisma } from '@prisma/client';

type AdminAuditInput = {
  actorId: string;
  action: string;
  resourceType: string;
  resourceKey: string;
  beforeJson?: Prisma.InputJsonValue | Prisma.JsonNull | null;
  afterJson?: Prisma.InputJsonValue | Prisma.JsonNull | null;
  request: Request;
};

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
      beforeJson: input.beforeJson,
      afterJson: input.afterJson,
      ip,
      userAgent,
    },
  });
}
