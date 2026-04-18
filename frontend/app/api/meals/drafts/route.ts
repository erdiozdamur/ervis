import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createMealDraftFromIntake } from '@/services/meals/meal-intake-service';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      {
        ok: false,
        message: 'The draft could not be created from this request.',
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
        message: 'The draft could not be created right now. Please try again.',
      },
      { status: 500 },
    );
  }
}
