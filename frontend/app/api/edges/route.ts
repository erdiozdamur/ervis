import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { createAuditLog } from '@/features/audit/service';

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('team'), organizationId: z.string(), sourceId: z.string(), targetId: z.string() }),
  z.object({ kind: z.literal('employee'), teamId: z.string(), sourceId: z.string(), targetId: z.string() }),
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = schema.parse(await req.json());

  if (body.kind === 'team') {
    const org = await prisma.organization.findFirst({ where: { id: body.organizationId, ownerId: session.user.id } });
    if (!org) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const edge = await prisma.teamEdge.create({ data: { organizationId: body.organizationId, sourceTeamId: body.sourceId, targetTeamId: body.targetId } });
    await createAuditLog({ actorId: session.user.id, organizationId: body.organizationId, action: 'EDGE_CREATED', subjectType: 'TeamEdge', subjectId: edge.id });
    return NextResponse.json(edge);
  }

  const team = await prisma.team.findFirst({ where: { id: body.teamId, organization: { ownerId: session.user.id } } });
  if (!team) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const edge = await prisma.employeeEdge.create({ data: { teamId: body.teamId, sourceEmployeeId: body.sourceId, targetEmployeeId: body.targetId } });
  await createAuditLog({ actorId: session.user.id, organizationId: team.organizationId, action: 'EDGE_CREATED', subjectType: 'EmployeeEdge', subjectId: edge.id });
  return NextResponse.json(edge);
}
