import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { confirmOwnedMealDraft } from '@/services/meals/meal-confirm-service';
import type { MealDraftConfirmResult } from '@/types/meal-analysis';

type ConfirmMealRouteContext = {
  params: {
    mealId: string;
  };
};

export async function POST(_request: Request, { params }: ConfirmMealRouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await confirmOwnedMealDraft(session.user.id, params.mealId);

    if (!result.ok) {
      const response: MealDraftConfirmResult = {
        ok: false,
        message: result.message,
      };

      return NextResponse.json(response, {
        status: result.code === 'not_found' ? 404 : 409,
      });
    }

    return NextResponse.json({ ok: true, mealId: result.mealId, redirectTo: result.redirectTo } satisfies MealDraftConfirmResult, {
      status: 200,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'This meal could not be confirmed right now. Please try again.',
      } satisfies MealDraftConfirmResult,
      { status: 500 },
    );
  }
}
