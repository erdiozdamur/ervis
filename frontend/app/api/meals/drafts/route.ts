import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createMealDraftFromIntake } from '@/services/meals/meal-intake-service';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Bu istekten taslak oluşturulamadı.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await createMealDraftFromIntake(session.user.id, formData);
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Taslak şu anda oluşturulamadı. Lütfen tekrar dene.',
      },
      { status: 500 },
    );
  }
}
