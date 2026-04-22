import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getSearchParamsObject } from '@/lib/api/validation';
import { requireAdmin } from '@/lib/auth/admin';

const adminAuditListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  resourceType: z.string().trim().min(1).max(120).optional(),
  actorId: z.string().trim().min(1).optional(),
  actor: z.string().trim().min(1).max(320).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

function toCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function jsonToText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

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

  const dateFrom = parsedQuery.data.dateFrom;
  const dateTo = parsedQuery.data.dateTo;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return NextResponse.json({ message: 'Tarih aralığı geçersiz. dateFrom, dateTo değerinden büyük olamaz.' }, { status: 400 });
  }

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      actorId: parsedQuery.data.actorId,
      resourceType: parsedQuery.data.resourceType,
      createdAt: dateFrom || dateTo ? { gte: dateFrom, lte: dateTo } : undefined,
      actor: parsedQuery.data.actor
        ? {
            email: {
              contains: parsedQuery.data.actor,
              mode: 'insensitive',
            },
          }
        : undefined,
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

  if (parsedQuery.data.format === 'csv') {
    const header = ['id', 'createdAt', 'actorId', 'actorEmail', 'action', 'resourceType', 'resourceKey', 'beforeJson', 'afterJson'];

    const rows = logs.map((log) =>
      [
        log.id,
        log.createdAt.toISOString(),
        log.actorId,
        log.actor.email,
        log.action,
        log.resourceType,
        log.resourceKey,
        jsonToText(log.beforeJson),
        jsonToText(log.afterJson),
      ]
        .map((value) => toCsvCell(value))
        .join(','),
    );

    return new NextResponse([header.join(','), ...rows].join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="admin-audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ ok: true, logs }, { status: 200 });
}
