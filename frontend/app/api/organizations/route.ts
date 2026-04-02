import { NextRequest, NextResponse } from 'next/server';
import { EntityStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { createAuditLog } from '@/features/audit/service';
import { canAccessOrganization } from '@/server/auth/access';

const createSchema = z.object({ name: z.string().min(1), description: z.string().optional() });
const updateSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  status: z.nativeEnum(EntityStatus),
  tags: z.array(z.string()).default([]),
  instructions: z.string().default(''),
  attributes: z.string().default('{}'),
});
const archiveSchema = z.object({ organizationId: z.string() });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = createSchema.parse(await req.json());
  const org = await prisma.organization.create({ data: { name: body.name, description: body.description ?? '', ownerId: session.user.id } });
  await createAuditLog({ actorId: session.user.id, organizationId: org.id, action: 'ORGANIZATION_CREATED', subjectType: 'Organization', subjectId: org.id });
  return NextResponse.json(org);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = updateSchema.parse(await req.json());
  if (!(await canAccessOrganization(session.user.id, body.organizationId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updated = await prisma.organization.update({
    where: { id: body.organizationId },
    data: {
      name: body.name,
      description: body.description,
      status: body.status,
      tags: body.tags,
      instructions: body.instructions,
      attributes: JSON.parse(body.attributes || '{}'),
    },
  });
  await createAuditLog({ actorId: session.user.id, organizationId: body.organizationId, action: 'ORGANIZATION_UPDATED', subjectType: 'Organization', subjectId: body.organizationId });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = archiveSchema.parse(await req.json());
  if (!(await canAccessOrganization(session.user.id, body.organizationId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const updated = await prisma.organization.update({ where: { id: body.organizationId }, data: { status: 'ARCHIVED' } });
  await createAuditLog({ actorId: session.user.id, organizationId: body.organizationId, action: 'ENTITY_ARCHIVED', subjectType: 'Organization', subjectId: body.organizationId });
  return NextResponse.json(updated);
}
