import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { canAccessOrganization } from '@/server/auth/access';
import { createAuditLog } from '@/features/audit/service';

const createSchema = z.object({ organizationId: z.string(), name: z.string().min(1) });
const moveSchema = z.object({ teamId: z.string(), positionX: z.number(), positionY: z.number() });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = createSchema.parse(await req.json());
  if (!(await canAccessOrganization(session.user.id, body.organizationId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const team = await prisma.team.create({ data: body });
  await createAuditLog({ actorId: session.user.id, organizationId: body.organizationId, action: 'TEAM_CREATED', subjectType: 'Team', subjectId: team.id });
  return NextResponse.json(team);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = moveSchema.parse(await req.json());
  const team = await prisma.team.findUnique({ where: { id: body.teamId }, include: { organization: true } });
  if (!team || team.organization.ownerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const updated = await prisma.team.update({ where: { id: body.teamId }, data: { positionX: body.positionX, positionY: body.positionY } });
  await createAuditLog({ actorId: session.user.id, organizationId: team.organizationId, action: 'NODE_MOVED', subjectType: 'Team', subjectId: team.id, metadata: { x: body.positionX, y: body.positionY } });
  return NextResponse.json(updated);
}
