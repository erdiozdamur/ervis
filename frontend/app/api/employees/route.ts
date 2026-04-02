import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { canAccessTeam } from '@/server/auth/access';
import { createAuditLog } from '@/features/audit/service';

const createSchema = z.object({ organizationId: z.string(), teamId: z.string(), name: z.string().min(1), title: z.string().optional() });
const moveSchema = z.object({ employeeId: z.string(), positionX: z.number(), positionY: z.number() });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = createSchema.parse(await req.json());
  if (!(await canAccessTeam(session.user.id, body.teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const employee = await prisma.employee.create({ data: body });
  await createAuditLog({ actorId: session.user.id, organizationId: body.organizationId, action: 'EMPLOYEE_CREATED', subjectType: 'Employee', subjectId: employee.id });
  return NextResponse.json(employee);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = moveSchema.parse(await req.json());
  const employee = await prisma.employee.findUnique({ where: { id: body.employeeId }, include: { organization: true } });
  if (!employee || employee.organization.ownerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const updated = await prisma.employee.update({ where: { id: body.employeeId }, data: { positionX: body.positionX, positionY: body.positionY } });
  await createAuditLog({ actorId: session.user.id, organizationId: employee.organizationId, action: 'NODE_MOVED', subjectType: 'Employee', subjectId: employee.id, metadata: { x: body.positionX, y: body.positionY } });
  return NextResponse.json(updated);
}
