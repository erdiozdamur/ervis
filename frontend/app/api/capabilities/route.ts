import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { canAccessEmployee, canAccessTeam } from '@/server/auth/access';
import { createAuditLog } from '@/features/audit/service';
import { resolveEffectiveCapabilities } from '@/server/services/capabilities';

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('employee'), employeeId: z.string(), capabilityIds: z.array(z.string()) }),
  z.object({ kind: z.literal('team'), teamId: z.string(), capabilityIds: z.array(z.string()) }),
]);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const employeeId = req.nextUrl.searchParams.get('employeeId');
  const teamId = req.nextUrl.searchParams.get('teamId');
  const capabilities = await prisma.capability.findMany({ orderBy: { label: 'asc' } });
  if (teamId) {
    if (!(await canAccessTeam(session.user.id, teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const assigned = await prisma.teamCapability.findMany({ where: { teamId }, select: { capabilityId: true } });
    return NextResponse.json({ capabilities, assignedCapabilityIds: assigned.map((a) => a.capabilityId) });
  }
  if (!employeeId) return NextResponse.json({ capabilities });
  if (!(await canAccessEmployee(session.user.id, employeeId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const assigned = await prisma.employeeCapability.findMany({ where: { employeeId }, select: { capabilityId: true } });
  const effective = await resolveEffectiveCapabilities(employeeId, true);
  return NextResponse.json({ capabilities, assignedCapabilityIds: assigned.map((a) => a.capabilityId), effective });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = schema.parse(await req.json());

  if (body.kind === 'employee') {
    if (!(await canAccessEmployee(session.user.id, body.employeeId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } });
    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.employeeCapability.deleteMany({ where: { employeeId: body.employeeId } });
    if (body.capabilityIds.length) {
      await prisma.employeeCapability.createMany({ data: body.capabilityIds.map((capabilityId) => ({ employeeId: body.employeeId, capabilityId, grantedById: session.user.id })) });
    }
    await createAuditLog({ actorId: session.user.id, organizationId: employee.organizationId, action: 'CAPABILITY_ASSIGNED', subjectType: 'Employee', subjectId: body.employeeId, metadata: { capabilityIds: body.capabilityIds } });
    return NextResponse.json({ ok: true });
  }

  if (!(await canAccessTeam(session.user.id, body.teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const team = await prisma.team.findUnique({ where: { id: body.teamId } });
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.teamCapability.deleteMany({ where: { teamId: body.teamId } });
  if (body.capabilityIds.length) {
    await prisma.teamCapability.createMany({ data: body.capabilityIds.map((capabilityId) => ({ teamId: body.teamId, capabilityId, grantedById: session.user.id })) });
  }
  await createAuditLog({ actorId: session.user.id, organizationId: team.organizationId, action: 'CAPABILITY_ASSIGNED', subjectType: 'Team', subjectId: body.teamId, metadata: { capabilityIds: body.capabilityIds } });
  return NextResponse.json({ ok: true });
}
