import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getSearchParamsObject } from '@/lib/api/validation';
import { requireAdmin } from '@/lib/auth/admin';

const adminAuditListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  resourceType: z.string().trim().min(1).max(120).optional(),
  actorId: z.string().trim().min(1).optional(),
});

export async function GET(request: Request) {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const parsedQuery = adminAuditListQuerySchema.safeParse(getSearchParamsObject(request));

  if (!parsedQuery.success) {
    return NextResponse.json(
      { message: 'Geçersiz sorgu parametreleri.', issues: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      actorId: parsedQuery.data.actorId,
      resourceType: parsedQuery.data.resourceType,
    },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: parsedQuery.data.limit,
  });

  return NextResponse.json({ ok: true, logs }, { status: 200 });
}
