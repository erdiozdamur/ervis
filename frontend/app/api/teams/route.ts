import { NextRequest, NextResponse } from 'next/server';
import { EntityStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { canAccessOrganization, canAccessTeam } from '@/server/auth/access';
import { createAuditLog } from '@/features/audit/service';

const createSchema = z.object({ organizationId: z.string(), name: z.string().min(1), rolePurpose: z.string().optional() });
const updateSchema = z.object({
  teamId: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  status: z.nativeEnum(EntityStatus),
  tags: z.array(z.string()).default([]),
  rolePurpose: z.string().default(''),
  instructions: z.string().default(''),
  attributes: z.string().default('{}'),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});
const moveSchema = z.object({ teamId: z.string(), positionX: z.number(), positionY: z.number() });
const archiveSchema = z.object({ teamId: z.string() });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = createSchema.parse(await req.json());
  if (!(await canAccessOrganization(session.user.id, body.organizationId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const team = await prisma.team.create({ data: { organizationId: body.organizationId, name: body.name, rolePurpose: body.rolePurpose ?? '' } });
  await createAuditLog({ actorId: session.user.id, organizationId: body.organizationId, action: 'TEAM_CREATED', subjectType: 'Team', subjectId: team.id });
  return NextResponse.json(team);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await req.json();
  if ('positionX' in payload && 'positionY' in payload && Object.keys(payload).length === 3) {
    const body = moveSchema.parse(payload);
    if (!(await canAccessTeam(session.user.id, body.teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const updated = await prisma.team.update({ where: { id: body.teamId }, data: { positionX: body.positionX, positionY: body.positionY } });
    await createAuditLog({ actorId: session.user.id, organizationId: updated.organizationId, action: 'NODE_MOVED', subjectType: 'Team', subjectId: body.teamId, metadata: { x: body.positionX, y: body.positionY } });
    return NextResponse.json(updated);
  }

  const body = updateSchema.parse(payload);
  if (!(await canAccessTeam(session.user.id, body.teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const team = await prisma.team.update({
    where: { id: body.teamId },
    data: {
      name: body.name,
      description: body.description,
      status: body.status,
      tags: body.tags,
      rolePurpose: body.rolePurpose,
      instructions: body.instructions,
      attributes: JSON.parse(body.attributes || '{}'),
      positionX: body.positionX,
      positionY: body.positionY,
    },
  });
  await createAuditLog({ actorId: session.user.id, organizationId: team.organizationId, action: 'TEAM_UPDATED', subjectType: 'Team', subjectId: team.id });
  return NextResponse.json(team);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = archiveSchema.parse(await req.json());
  if (!(await canAccessTeam(session.user.id, body.teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const team = await prisma.team.update({ where: { id: body.teamId }, data: { status: 'ARCHIVED' } });
  await createAuditLog({ actorId: session.user.id, organizationId: team.organizationId, action: 'ENTITY_ARCHIVED', subjectType: 'Team', subjectId: team.id });
  return NextResponse.json(team);
}
