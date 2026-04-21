import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { requireAdminApiAccess } from '@/lib/auth/admin';
import { writeAdminAuditLog } from '@/lib/admin-audit';

const SETTINGS_KEY = 'admin.settings';

export async function GET() {
  const auth = await requireAdminApiAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const settings = await prisma.appMeta.findUnique({ where: { key: SETTINGS_KEY } });
  return NextResponse.json({ ok: true, settings: settings?.value ? JSON.parse(settings.value) : {} });
}

export async function PUT(request: Request) {
  const auth = await requireAdminApiAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as { settings?: Record<string, unknown> } | null;

  if (!body?.settings || typeof body.settings !== 'object') {
    return NextResponse.json({ message: 'Geçersiz ayar payload.' }, { status: 400 });
  }

  const existing = await prisma.appMeta.findUnique({ where: { key: SETTINGS_KEY } });

  const updated = await prisma.appMeta.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(body.settings) },
    update: { value: JSON.stringify(body.settings) },
  });

  await writeAdminAuditLog({
    actorUserId: auth.user.id,
    action: 'admin.settings.update',
    targetType: 'AppMeta',
    targetId: updated.id,
    beforeState: existing?.value ? JSON.parse(existing.value) : Prisma.JsonNull,
    afterState: body.settings as Prisma.JsonObject,
  });

  return NextResponse.json({ ok: true, settings: body.settings });
}
