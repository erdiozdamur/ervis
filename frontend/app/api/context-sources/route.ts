import { NextRequest, NextResponse } from 'next/server';
import { ContextOwnerType, ContextSourceType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { canAccessContextOwner } from '@/server/auth/access';
import { createAuditLog } from '@/features/audit/service';

const schema = z.object({
  id: z.string().optional(),
  organizationId: z.string(),
  ownerType: z.nativeEnum(ContextOwnerType),
  ownerId: z.string(),
  title: z.string().min(1),
  type: z.nativeEnum(ContextSourceType),
  content: z.string().min(1),
  metadata: z.string().default('{}'),
});

const deleteSchema = z.object({ id: z.string() });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = schema.parse(await req.json());
  if (!(await canAccessContextOwner(session.user.id, body.ownerType, body.ownerId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const source = await prisma.contextSource.create({
    data: {
      organizationId: body.organizationId,
      ownerType: body.ownerType,
      ownerId: body.ownerId,
      title: body.title,
      type: body.type,
      content: body.content,
      metadata: JSON.parse(body.metadata || '{}'),
    },
  });
  await createAuditLog({ actorId: session.user.id, organizationId: body.organizationId, action: 'CONTEXT_SOURCE_CREATED', subjectType: 'ContextSource', subjectId: source.id });
  return NextResponse.json(source);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = schema.extend({ id: z.string() }).parse(await req.json());
  if (!(await canAccessContextOwner(session.user.id, body.ownerType, body.ownerId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const source = await prisma.contextSource.update({
    where: { id: body.id },
    data: { title: body.title, type: body.type, content: body.content, metadata: JSON.parse(body.metadata || '{}') },
  });
  await createAuditLog({ actorId: session.user.id, organizationId: body.organizationId, action: 'CONTEXT_SOURCE_UPDATED', subjectType: 'ContextSource', subjectId: source.id });
  return NextResponse.json(source);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = deleteSchema.parse(await req.json());
  const source = await prisma.contextSource.findUnique({ where: { id: body.id } });
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await canAccessContextOwner(session.user.id, source.ownerType, source.ownerId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await prisma.contextSource.delete({ where: { id: body.id } });
  await createAuditLog({ actorId: session.user.id, organizationId: source.organizationId, action: 'CONTEXT_SOURCE_DELETED', subjectType: 'ContextSource', subjectId: source.id });
  return NextResponse.json({ ok: true });
}
