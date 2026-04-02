import { NextRequest, NextResponse } from 'next/server';
import { ContextOwnerType } from '@prisma/client';
import { auth } from '@/auth';
import { canAccessContextOwner } from '@/server/auth/access';
import { resolveInheritedContext } from '@/server/services/context';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ownerType = req.nextUrl.searchParams.get('ownerType') as ContextOwnerType | null;
  const ownerId = req.nextUrl.searchParams.get('ownerId');
  if (!ownerType || !ownerId) return NextResponse.json({ error: 'ownerType and ownerId are required' }, { status: 400 });
  if (!(await canAccessContextOwner(session.user.id, ownerType, ownerId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const data = await resolveInheritedContext({ ownerType, ownerId });
  return NextResponse.json(data);
}
