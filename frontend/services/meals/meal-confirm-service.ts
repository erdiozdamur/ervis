import { prisma } from '@/db/prisma';
import { getAppDayKey } from '@/lib/date/istanbul';
import { parseDraftPortion } from '@/lib/meals/draft-review';
import { estimateGramsFromPortion } from '@/lib/meals/portion-grams';
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

function toSafeMacro(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return roundValue(value);
}

function hasInvalidDraftItems(draftResult: MealDraftAnalysisResult) {
  return draftResult.items.some((item) => {
    const hasName = item.displayName.trim().length > 0;
    const hasMacros =
      Number.isFinite(item.macros.calories) &&
      item.macros.calories >= 0 &&
      Number.isFinite(item.macros.proteinGrams) &&
      item.macros.proteinGrams >= 0 &&
      Number.isFinite(item.macros.carbGrams) &&
      item.macros.carbGrams >= 0 &&
      Number.isFinite(item.macros.fatGrams) &&
      item.macros.fatGrams >= 0 &&
      Number.isFinite(item.macros.fiberGrams) &&
      item.macros.fiberGrams >= 0;

    return !hasName || !hasMacros;
  });
}

export function buildConfirmedMealItemsFromDraft(mealId: string, draftResult: MealDraftAnalysisResult) {
  return draftResult.items.map((item, index) => {
    const portion = parseDraftPortion(item.quantityText);
    const quantityAmount = portion.quantityAmount != null && portion.quantityAmount > 0 ? roundValue(portion.quantityAmount) : 1;
    const quantityUnit = (portion.quantityUnit ?? '').trim() || 'porsiyon';
    const estimatedGrams = estimateGramsFromPortion(quantityAmount, quantityUnit, item.displayName);

    return {
      mealId,
      sortOrder: index,
      displayName: item.displayName.trim(),
      quantityAmount,
      quantityUnit,
      gramsEstimate: item.gramsEstimate != null ? roundValue(item.gramsEstimate) : estimatedGrams,
      calories: toSafeMacro(item.macros.calories),
      proteinGrams: toSafeMacro(item.macros.proteinGrams),
      carbGrams: toSafeMacro(item.macros.carbGrams),
      fatGrams: toSafeMacro(item.macros.fatGrams),
      fiberGrams: toSafeMacro(item.macros.fiberGrams),
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
      message: 'Bu öğün taslağı hesabında bulunamadı.',
    };
  }

  if (meal.status === 'CONFIRMED') {
    const dayKey = getAppDayKey(meal.mealDate);

    return {
      ok: true,
      mealId: meal.id,
      redirectTo: dayKey === getAppDayKey(new Date()) ? '/app' : `/app?day=${dayKey}`,
    };
  }

  const draftResult = meal.analysisRuns[0]?.draftResultJson as MealDraftAnalysisResult | null;

  if (!draftResult || draftResult.items.length === 0) {
    return {
      ok: false,
      code: 'conflict',
      message: 'Henüz onaylanabilecek bir taslak sonucu yok.',
    };
  }

  if (hasInvalidDraftItems(draftResult)) {
    return {
      ok: false,
      code: 'conflict',
      message: 'Bazı besinlerde ad veya makro bilgisi eksik. Lütfen önce düzenleyip tamamla.',
    };
  }

  const totalCalories = draftResult.items.reduce((sum, item) => sum + (item.macros.calories || 0), 0);
  if (totalCalories <= 0) {
    return {
      ok: false,
      code: 'conflict',
      message: 'Taslak kalori bilgisi sıfır görünüyor. Lütfen analizi yeniden çalıştır veya öğeyi düzenle.',
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
    redirectTo: dayKey === getAppDayKey(new Date()) ? '/app' : `/app?day=${dayKey}`,
  };
}
