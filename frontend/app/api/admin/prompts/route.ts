import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { requireAdminApiAccess } from '@/lib/auth/admin';
import { writeAdminAuditLog } from '@/lib/admin-audit';

const PROMPTS_KEY = 'admin.prompts';

export async function GET() {
  const auth = await requireAdminApiAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const prompts = await prisma.appMeta.findUnique({ where: { key: PROMPTS_KEY } });
  return NextResponse.json({ ok: true, prompts: prompts?.value ? JSON.parse(prompts.value) : {} });
}

export async function PUT(request: Request) {
  const auth = await requireAdminApiAccess();

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as { prompts?: Record<string, unknown> } | null;

  if (!body?.prompts || typeof body.prompts !== 'object') {
    return NextResponse.json({ message: 'Geçersiz prompt payload.' }, { status: 400 });
  }

  const existing = await prisma.appMeta.findUnique({ where: { key: PROMPTS_KEY } });

  const updated = await prisma.appMeta.upsert({
    where: { key: PROMPTS_KEY },
    create: { key: PROMPTS_KEY, value: JSON.stringify(body.prompts) },
    update: { value: JSON.stringify(body.prompts) },
  });

  await writeAdminAuditLog({
    actorUserId: auth.user.id,
    action: 'admin.prompts.update',
    targetType: 'AppMeta',
    targetId: updated.id,
    beforeState: existing?.value ? JSON.parse(existing.value) : Prisma.JsonNull,
    afterState: body.prompts as Prisma.JsonObject,
  });

  return NextResponse.json({ ok: true, prompts: body.prompts });
}
