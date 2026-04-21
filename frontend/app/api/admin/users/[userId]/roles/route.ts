import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { authOptions } from '@/lib/auth/options';
import { hasAnyRole, hasRole } from '@/lib/auth/admin';

const roleMutationSchema = z.object({
  role: z.nativeEnum(Role),
});

type RouteContext = {
  params: {
    userId: string;
  };
};

function canManageTargetRole(actorIsOwner: boolean, role: Role) {
  if (role === Role.OWNER) {
    return actorIsOwner;
  }

  return true;
}

async function ensureAdminActor() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: 'Yetkisiz erişim.' }, { status: 401 }) };
  }

  const actorId = session.user.id;
  const actorCanManageUsers = await hasAnyRole(actorId, [Role.OWNER, Role.ADMIN]);

  if (!actorCanManageUsers) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: 'Bu işlem için yetkin yok.' }, { status: 403 }) };
  }

  const actorIsOwner = await hasRole(actorId, Role.OWNER);
  return { ok: true as const, actorId, actorIsOwner };
}

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await ensureAdminActor();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = roleMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Geçerli bir rol gönder.' }, { status: 400 });
  }

  if (!canManageTargetRole(auth.actorIsOwner, parsed.data.role)) {
    return NextResponse.json({ ok: false, message: 'OWNER rolü sadece OWNER tarafından atanabilir.' }, { status: 403 });
  }

  await prisma.userRole.upsert({
    where: {
      userId_role: {
        userId: params.userId,
        role: parsed.data.role,
      },
    },
    update: {},
    create: {
      userId: params.userId,
      role: parsed.data.role,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await ensureAdminActor();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = roleMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Geçerli bir rol gönder.' }, { status: 400 });
  }

  if (!canManageTargetRole(auth.actorIsOwner, parsed.data.role)) {
    return NextResponse.json({ ok: false, message: 'OWNER rolü sadece OWNER tarafından kaldırılabilir.' }, { status: 403 });
  }

  if (params.userId === auth.actorId && parsed.data.role === Role.OWNER) {
    return NextResponse.json({ ok: false, message: 'Kendi OWNER rolünü kaldıramazsın.' }, { status: 409 });
  }

  if (parsed.data.role === Role.OWNER) {
    const ownerCount = await prisma.userRole.count({ where: { role: Role.OWNER } });

    if (ownerCount <= 1) {
      return NextResponse.json({ ok: false, message: 'Sistemde en az bir OWNER kalmalı.' }, { status: 409 });
    }
  }

  await prisma.userRole.deleteMany({
    where: {
      userId: params.userId,
      role: parsed.data.role,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
