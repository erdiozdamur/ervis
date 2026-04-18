import { prisma } from '@/db/prisma';
import { getAppDayKey } from '@/lib/date/istanbul';
import { parseDraftPortion } from '@/lib/meals/draft-review';
import type { MealDraftAnalysisResult } from '@/types/meal-analysis';

type MealDraftConfirmServiceResult =
  | {
      ok: true;
      mealId: string;
      redirectTo: string;
    }
  | {
      ok: false;
      code: 'not_found' | 'conflict';
      message: string;
    };

function roundValue(value: number) {
  return Math.round(value * 10) / 10;
}

export function buildConfirmedMealItemsFromDraft(mealId: string, draftResult: MealDraftAnalysisResult) {
  return draftResult.items.map((item, index) => {
    const portion = parseDraftPortion(item.quantityText);

    return {
      mealId,
      sortOrder: index,
      displayName: item.displayName,
      quantityAmount: portion.quantityAmount,
      quantityUnit: portion.quantityUnit,
      gramsEstimate: item.gramsEstimate != null ? roundValue(item.gramsEstimate) : null,
      calories: roundValue(item.macros.calories),
      proteinGrams: roundValue(item.macros.proteinGrams),
      carbGrams: roundValue(item.macros.carbGrams),
      fatGrams: roundValue(item.macros.fatGrams),
      fiberGrams: roundValue(item.macros.fiberGrams),
      normalizedFoodEntryId: item.nutritionSource === 'USER_REVIEW' ? null : item.normalizedFoodEntryId,
      nutritionCacheEntryId: item.nutritionSource === 'USER_REVIEW' ? null : item.nutritionCacheEntryId,
    };
  });
}

export async function confirmOwnedMealDraft(userId: string, mealId: string): Promise<MealDraftConfirmServiceResult> {
  const meal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userId,
    },
    select: {
      id: true,
      mealDate: true,
      status: true,
      analysisRuns: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
        select: {
          draftResultJson: true,
        },
      },
    },
  });

  if (!meal) {
    return {
      ok: false,
      code: 'not_found',
      message: 'This meal draft could not be found for your account.',
    };
  }

  if (meal.status === 'CONFIRMED') {
    const dayKey = getAppDayKey(meal.mealDate);

    return {
      ok: true,
      mealId: meal.id,
      redirectTo: dayKey === getAppDayKey(new Date()) ? '/app' : `/app/history?day=${dayKey}`,
    };
  }

  const draftResult = meal.analysisRuns[0]?.draftResultJson as MealDraftAnalysisResult | null;

  if (!draftResult || draftResult.items.length === 0) {
    return {
      ok: false,
      code: 'conflict',
      message: 'There is no reviewable draft result to confirm yet.',
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.mealItem.deleteMany({
      where: {
        mealId: meal.id,
      },
    });

    await tx.mealItem.createMany({
      data: buildConfirmedMealItemsFromDraft(meal.id, draftResult),
    });

    await tx.meal.update({
      where: {
        id: meal.id,
      },
      data: {
        title: draftResult.titleSuggestion,
        mealType: draftResult.mealTypeSuggestion,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });
  });

  const dayKey = getAppDayKey(meal.mealDate);

  return {
    ok: true,
    mealId: meal.id,
    redirectTo: dayKey === getAppDayKey(new Date()) ? '/app' : `/app/history?day=${dayKey}`,
  };
}
