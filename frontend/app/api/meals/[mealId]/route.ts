import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { finalMealUpdateSchema, flattenFinalMealFieldErrors } from '@/lib/meals/final-meal-validation';
import { flattenMealFieldErrors, mealUpdateSchema } from '@/lib/meals/validation';
import { getOwnedMealEditorSnapshot, updateOwnedFinalMeal } from '@/services/meals/meal-editor-service';
import { deleteOwnedMeal, updateOwnedMeal } from '@/services/meals/meal-service';
import type { MealDeleteResult, MealSaveResult, MealUpdateResult } from '@/types/meals';

type MealRouteContext = {
  params: {
    mealId: string;
  };
};

export async function GET(_request: Request, { params }: MealRouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const meal = await getOwnedMealEditorSnapshot(session.user.id, params.mealId);

  if (!meal) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Öğün bulunamadı.',
      },
      { status: 404 },
    );
  }

  if (meal.status === 'DRAFT') {
    return NextResponse.json(
      {
        ok: false,
        message: 'Taslak öğünler bu panelde düzenlenemez.',
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, meal }, { status: 200 });
}

export async function PATCH(request: Request, { params }: MealRouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = mealUpdateSchema.safeParse(body);

  if (!parsed.success) {
    const response: MealUpdateResult = {
      ok: false,
      message: 'Please check the highlighted meal details and try again.',
      fieldErrors: flattenMealFieldErrors(parsed.error),
    };

    return NextResponse.json(response, { status: 400 });
  }

  const updatedMeal = await updateOwnedMeal(session.user.id, params.mealId, parsed.data);

  if (!updatedMeal) {
    const response: MealUpdateResult = {
      ok: false,
      message: 'This meal could not be found for your account.',
    };

    return NextResponse.json(response, { status: 404 });
  }

  return NextResponse.json({ ok: true, meal: updatedMeal } satisfies MealUpdateResult, { status: 200 });
}

export async function PUT(request: Request, { params }: MealRouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = finalMealUpdateSchema.safeParse(body);

  if (!parsed.success) {
    const response: MealSaveResult = {
      ok: false,
      message: 'Please check the highlighted meal items and try again.',
      fieldErrors: flattenFinalMealFieldErrors(parsed.error),
    };

    return NextResponse.json(response, { status: 400 });
  }

  const result = await updateOwnedFinalMeal(session.user.id, params.mealId, parsed.data);

  if (!result.ok) {
    const response: MealSaveResult = {
      ok: false,
      message: result.message,
    };

    return NextResponse.json(response, {
      status: result.code === 'not_found' ? 404 : 409,
    });
  }

  return NextResponse.json({ ok: true, mealId: result.mealId, redirectTo: result.redirectTo } satisfies MealSaveResult, {
    status: 200,
  });
}

export async function DELETE(_request: Request, { params }: MealRouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const deleted = await deleteOwnedMeal(session.user.id, params.mealId);

  if (!deleted) {
    const response: MealDeleteResult = {
      ok: false,
      message: 'This meal could not be found for your account.',
    };

    return NextResponse.json(response, { status: 404 });
  }

  return NextResponse.json({ ok: true } satisfies MealDeleteResult, { status: 200 });
}
