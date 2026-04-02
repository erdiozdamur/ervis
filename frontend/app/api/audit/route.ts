import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/db/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get('organizationId');
  const subjectType = req.nextUrl.searchParams.get('subjectType');
  const action = req.nextUrl.searchParams.get('action');

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(orgId ? { organizationId: orgId, organization: { ownerId: session.user.id } } : { actorId: session.user.id }),
      ...(subjectType ? { subjectType } : {}),
      ...(action ? { action: action as never } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(logs);
}
