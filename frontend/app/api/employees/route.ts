import { NextRequest, NextResponse } from 'next/server';
import { EntityStatus, ModelPreference } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { canAccessEmployee, canAccessTeam } from '@/server/auth/access';
import { createAuditLog } from '@/features/audit/service';

const createSchema = z.object({ organizationId: z.string(), teamId: z.string(), name: z.string().min(1), title: z.string().optional() });
const moveSchema = z.object({ employeeId: z.string(), positionX: z.number(), positionY: z.number() });
const updateSchema = z.object({
  employeeId: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  status: z.nativeEnum(EntityStatus),
  tags: z.array(z.string()).default([]),
  title: z.string().nullable().optional(),
  specialization: z.string().default(''),
  modelPreference: z.nativeEnum(ModelPreference),
  instructions: z.string().default(''),
  attributes: z.string().default('{}'),
  active: z.boolean().default(true),
});
const archiveSchema = z.object({ employeeId: z.string() });

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
  const payload = await req.json();
  if ('positionX' in payload && 'positionY' in payload && Object.keys(payload).length === 3) {
    const body = moveSchema.parse(payload);
    if (!(await canAccessEmployee(session.user.id, body.employeeId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const updated = await prisma.employee.update({ where: { id: body.employeeId }, data: { positionX: body.positionX, positionY: body.positionY } });
    await createAuditLog({ actorId: session.user.id, organizationId: updated.organizationId, action: 'NODE_MOVED', subjectType: 'Employee', subjectId: body.employeeId, metadata: { x: body.positionX, y: body.positionY } });
    return NextResponse.json(updated);
  }

  const body = updateSchema.parse(payload);
  if (!(await canAccessEmployee(session.user.id, body.employeeId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const employee = await prisma.employee.update({
    where: { id: body.employeeId },
    data: {
      name: body.name,
      description: body.description,
      status: body.status,
      tags: body.tags,
      title: body.title,
      specialization: body.specialization,
      modelPreference: body.modelPreference,
      instructions: body.instructions,
      attributes: JSON.parse(body.attributes || '{}'),
      active: body.active,
    },
  });
  await createAuditLog({ actorId: session.user.id, organizationId: employee.organizationId, action: 'EMPLOYEE_UPDATED', subjectType: 'Employee', subjectId: employee.id });
  return NextResponse.json(employee);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = archiveSchema.parse(await req.json());
  if (!(await canAccessEmployee(session.user.id, body.employeeId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const employee = await prisma.employee.update({ where: { id: body.employeeId }, data: { status: 'ARCHIVED', active: false } });
  await createAuditLog({ actorId: session.user.id, organizationId: employee.organizationId, action: 'ENTITY_ARCHIVED', subjectType: 'Employee', subjectId: employee.id });
  return NextResponse.json(employee);
}
