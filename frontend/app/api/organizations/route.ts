import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { createAuditLog } from '@/features/audit/service';

const schema = z.object({ name: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = schema.parse(await req.json());
  const org = await prisma.organization.create({
    data: { name: body.name, ownerId: session.user.id },
  });
  await createAuditLog({
    actorId: session.user.id,
    organizationId: org.id,
    action: 'ORGANIZATION_CREATED',
    subjectType: 'Organization',
    subjectId: org.id,
  });
  return NextResponse.json(org);
}
