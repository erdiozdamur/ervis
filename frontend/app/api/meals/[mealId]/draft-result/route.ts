import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import {
  flattenMealDraftResultFieldErrors,
  mealDraftResultUpdateSchema,
} from '@/lib/meals/draft-result-validation';
import { updateLatestOwnedMealDraftResult } from '@/services/meals/draft-result-service';
import type { MealDraftResultUpdateResult } from '@/types/meal-analysis';

type DraftResultRouteContext = {
  params: {
    mealId: string;
  };
};

export async function PATCH(request: Request, { params }: DraftResultRouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = mealDraftResultUpdateSchema.safeParse(body);

  if (!parsed.success) {
    const response: MealDraftResultUpdateResult = {
      ok: false,
      message: 'Please check the highlighted draft details and try again.',
      fieldErrors: flattenMealDraftResultFieldErrors(parsed.error),
    };

    return NextResponse.json(response, { status: 400 });
  }

  const result = await updateLatestOwnedMealDraftResult(session.user.id, params.mealId, parsed.data);

  if (!result.ok) {
    const response: MealDraftResultUpdateResult = {
      ok: false,
      message: result.message,
    };

    return NextResponse.json(response, {
      status: result.code === 'not_found' ? 404 : 409,
    });
  }

  return NextResponse.json({ ok: true, draftResult: result.draftResult } satisfies MealDraftResultUpdateResult, { status: 200 });
}
