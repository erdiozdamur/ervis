import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireAdminApiAccess } from '@/lib/auth/admin';
import { writeAdminAuditLog } from '@/lib/admin-audit';

export async function GET() {
  const auth = await requireAdminApiAccess();

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({ ok: true, roles: Object.values(Role) });
}

export async function PUT(request: Request) {
  const auth = await requireAdminApiAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as { roles?: Role[] } | null;

  if (!body?.roles?.length) {
    return NextResponse.json({ message: 'En az bir rol gönderilmelidir.' }, { status: 400 });
  }

  await writeAdminAuditLog({
    actorUserId: auth.user.id,
    action: 'admin.roles.update',
    targetType: 'RoleConfig',
    afterState: { roles: body.roles },
  });

  return NextResponse.json({ ok: true, roles: body.roles, message: 'Rol konfigürasyonu kaydedildi.' });
}
