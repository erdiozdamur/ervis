import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { requireAdmin } from '@/lib/auth/admin';

const ROLE_MATRIX: Record<UserRole, string[]> = {
  USER: ['Kendi profilini ve öğünlerini yönetebilir'],
  ADMIN: ['Yönetim panelini görüntüler', 'Ayarları ve logları görüntüler'],
  SUPER_ADMIN: ['Kullanıcı rol/durum değiştirebilir', 'Kritik ayarları yayınlayabilir', '4-eyes onayı verebilir'],
  OWNER: ['SUPER_ADMIN yetkilerine ek olarak en yüksek sistem sahibidir'],
};

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const grouped = await prisma.user.groupBy({ by: ['role'], _count: { role: true } });
  const countMap = new Map(grouped.map((row) => [row.role, row._count.role]));

  return NextResponse.json({
    ok: true,
    roles: (Object.keys(ROLE_MATRIX) as UserRole[]).map((role) => ({
      role,
      userCount: countMap.get(role) ?? 0,
      permissions: ROLE_MATRIX[role],
    })),
  });
}
