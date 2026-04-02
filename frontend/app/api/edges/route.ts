import { NextRequest, NextResponse } from 'next/server';
import { EdgeType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { canAccessOrganization, canAccessTeam } from '@/server/auth/access';
import { createAuditLog } from '@/features/audit/service';

const createSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('team'), organizationId: z.string(), sourceId: z.string(), targetId: z.string(), edgeType: z.nativeEnum(EdgeType).default(EdgeType.HIERARCHY) }),
  z.object({ kind: z.literal('employee'), teamId: z.string(), sourceId: z.string(), targetId: z.string(), edgeType: z.nativeEnum(EdgeType).default(EdgeType.HANDOFF) }),
]);

const updateSchema = z.object({
  edgeId: z.string(),
  kind: z.enum(['team', 'employee']),
  edgeType: z.nativeEnum(EdgeType),
  label: z.string().nullable().optional(),
  description: z.string().default(''),
  conditionNote: z.string().default(''),
});

const deleteSchema = z.object({ edgeId: z.string(), kind: z.enum(['team', 'employee']) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = createSchema.parse(await req.json());
  if (body.sourceId === body.targetId) return NextResponse.json({ error: 'Self loops are not allowed' }, { status: 400 });

  if (body.kind === 'team') {
    if (!(await canAccessOrganization(session.user.id, body.organizationId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const [source, target] = await Promise.all([
      prisma.team.findUnique({ where: { id: body.sourceId } }),
      prisma.team.findUnique({ where: { id: body.targetId } }),
    ]);
    if (!source || !target || source.organizationId !== body.organizationId || target.organizationId !== body.organizationId) {
      return NextResponse.json({ error: 'Invalid team edge' }, { status: 400 });
    }

    const edge = await prisma.teamEdge.create({ data: { organizationId: body.organizationId, sourceTeamId: body.sourceId, targetTeamId: body.targetId, edgeType: body.edgeType } });
    await createAuditLog({ actorId: session.user.id, organizationId: body.organizationId, action: 'EDGE_CREATED', subjectType: 'TeamEdge', subjectId: edge.id });
    return NextResponse.json(edge);
  }

  if (!(await canAccessTeam(session.user.id, body.teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [source, target] = await Promise.all([
    prisma.employee.findUnique({ where: { id: body.sourceId } }),
    prisma.employee.findUnique({ where: { id: body.targetId } }),
  ]);
  if (!source || !target || source.teamId !== body.teamId || target.teamId !== body.teamId) {
    return NextResponse.json({ error: 'Invalid employee edge' }, { status: 400 });
  }

  const edge = await prisma.employeeEdge.create({ data: { teamId: body.teamId, sourceEmployeeId: body.sourceId, targetEmployeeId: body.targetId, edgeType: body.edgeType } });
  await createAuditLog({ actorId: session.user.id, organizationId: source.organizationId, action: 'EDGE_CREATED', subjectType: 'EmployeeEdge', subjectId: edge.id });
  return NextResponse.json(edge);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = updateSchema.parse(await req.json());

  if (body.kind === 'team') {
    const edge = await prisma.teamEdge.findUnique({ where: { id: body.edgeId } });
    if (!edge || !(await canAccessOrganization(session.user.id, edge.organizationId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const updated = await prisma.teamEdge.update({ where: { id: body.edgeId }, data: { edgeType: body.edgeType, label: body.label, description: body.description, conditionNote: body.conditionNote } });
    await createAuditLog({ actorId: session.user.id, organizationId: edge.organizationId, action: 'EDGE_UPDATED', subjectType: 'TeamEdge', subjectId: edge.id });
    return NextResponse.json(updated);
  }

  const edge = await prisma.employeeEdge.findUnique({ where: { id: body.edgeId }, include: { team: true } });
  if (!edge || !(await canAccessTeam(session.user.id, edge.teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const updated = await prisma.employeeEdge.update({ where: { id: body.edgeId }, data: { edgeType: body.edgeType, label: body.label, description: body.description, conditionNote: body.conditionNote } });
  await createAuditLog({ actorId: session.user.id, organizationId: edge.team.organizationId, action: 'EDGE_UPDATED', subjectType: 'EmployeeEdge', subjectId: edge.id });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = deleteSchema.parse(await req.json());

  if (body.kind === 'team') {
    const edge = await prisma.teamEdge.findUnique({ where: { id: body.edgeId } });
    if (!edge || !(await canAccessOrganization(session.user.id, edge.organizationId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await prisma.teamEdge.delete({ where: { id: body.edgeId } });
    await createAuditLog({ actorId: session.user.id, organizationId: edge.organizationId, action: 'EDGE_DELETED', subjectType: 'TeamEdge', subjectId: edge.id });
    return NextResponse.json({ ok: true });
  }

  const edge = await prisma.employeeEdge.findUnique({ where: { id: body.edgeId }, include: { team: true } });
  if (!edge || !(await canAccessTeam(session.user.id, edge.teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await prisma.employeeEdge.delete({ where: { id: body.edgeId } });
  await createAuditLog({ actorId: session.user.id, organizationId: edge.team.organizationId, action: 'EDGE_DELETED', subjectType: 'EmployeeEdge', subjectId: edge.id });
  return NextResponse.json({ ok: true });
}
