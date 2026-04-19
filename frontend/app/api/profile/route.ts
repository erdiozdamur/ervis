import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { flattenProfileFieldErrors, profileFormSchema } from '@/lib/profile/validation';
import { getUserProfileSnapshot, upsertUserProfileWithTargets } from '@/services/profile/profile-service';
import type { ProfileUpdateResult } from '@/types/profile';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const profile = await getUserProfileSnapshot(session.user.id);
  return NextResponse.json({ ok: true, profile });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileFormSchema.safeParse(body);

  if (!parsed.success) {
    const response: ProfileUpdateResult = {
      ok: false,
      message: 'Lütfen işaretlenen alanları kontrol edip tekrar dene.',
      fieldErrors: flattenProfileFieldErrors(parsed.error),
    };

    return NextResponse.json(response, { status: 400 });
  }

  const profile = await upsertUserProfileWithTargets(session.user.id, parsed.data);
  return NextResponse.json({ ok: true, profile } satisfies ProfileUpdateResult, { status: 200 });
}
