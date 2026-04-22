import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getSearchParamsObject } from '@/lib/api/validation';
import { isAdminRole, requireAdmin, isSuperAdminRole } from '@/lib/auth/admin';

const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(['ACTIVE', 'PASSIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10),
});

export async function GET(request: Request) {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const parsedQuery = listUsersQuerySchema.safeParse(getSearchParamsObject(request));

  if (!parsedQuery.success) {
    return NextResponse.json(
      { message: 'Geçersiz sorgu parametreleri.', issues: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const { q, role, status, page, pageSize } = parsedQuery.data;

  const where = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(role ? { role } : {}),
    ...(status ? { isActive: status === 'ACTIVE' } : {}),
  };

  const [total, users, activeAdminCount] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({
      where: {
        isActive: true,
        role: {
          in: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
        },
      },
    }),
  ]);

  const canManageUsers = isSuperAdminRole(guard.user.role);

  const data = users.map((user) => {
    const isSelf = user.id === guard.user.id;
    const isPrivileged = isAdminRole(user.role);
    const wouldBreakLastAdmin = isPrivileged && user.isActive && activeAdminCount <= 1;

    return {
      ...user,
      guards: {
        canManage: canManageUsers,
        canChangeRole: canManageUsers && !isSelf && !wouldBreakLastAdmin,
        canToggleActive: canManageUsers && !isSelf && !wouldBreakLastAdmin,
        isSelf,
        wouldBreakLastAdmin,
      },
    };
  });

  return NextResponse.json(
    {
      ok: true,
      users: data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      filters: {
        q: q ?? '',
        role: role ?? null,
        status: status ?? null,
      },
    },
    { status: 200 },
  );
}
