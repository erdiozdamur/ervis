import { unstable_noStore as noStore } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';
import {
  formatDateInAppTimeZone,
  formatTimeInputInAppTimeZone,
  getAppDateTimeFromDayKeyAndTime,
  getAppDayDateFromDayKey,
  getAppDayKey,
} from '@/lib/date/istanbul';
import type { FinalMealUpdateInput } from '@/lib/meals/final-meal-validation';
import { estimateGramsFromPortion } from '@/lib/meals/portion-grams';
import type { MealEditorItem, MealEditorSnapshot } from '@/types/meals';

type UpdateOwnedFinalMealResult =
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

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value ? value.toNumber() : 0;
}

function roundValue(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

function normalizeOptionalText(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function sumEditorItems(items: MealEditorItem[]) {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + item.calories,
      proteinGrams: totals.proteinGrams + item.proteinGrams,
      carbGrams: totals.carbGrams + item.carbGrams,
      fatGrams: totals.fatGrams + item.fatGrams,
      fiberGrams: totals.fiberGrams + item.fiberGrams,
    }),
    {
      calories: 0,
      proteinGrams: 0,
      carbGrams: 0,
      fatGrams: 0,
      fiberGrams: 0,
    },
  );
}

export function buildMealItemCreateInputs(mealId: string, items: FinalMealUpdateInput['items']) {
  return items.map((item, index) => ({
    mealId,
    sortOrder: index,
    displayName: item.displayName,
    quantityAmount: roundValue(item.quantityAmount),
    quantityUnit: normalizeOptionalText(item.quantityUnit),
    gramsEstimate: roundValue(item.gramsEstimate),
    calories: roundValue(item.macros.calories),
    proteinGrams: roundValue(item.macros.proteinGrams),
    carbGrams: roundValue(item.macros.carbGrams),
    fatGrams: roundValue(item.macros.fatGrams),
    fiberGrams: roundValue(item.macros.fiberGrams),
    normalizedFoodEntryId: null,
    nutritionCacheEntryId: null,
  }));
}

export async function getOwnedMealEditorSnapshot(userId: string, mealId: string): Promise<MealEditorSnapshot | null> {
  noStore();

  const meal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userId,
    },
    select: {
      id: true,
      status: true,
      mealDate: true,
      title: true,
      mealType: true,
      consumedAt: true,
      notes: true,
      items: {
        orderBy: {
          sortOrder: 'asc',
        },
        select: {
          id: true,
          displayName: true,
          quantityAmount: true,
          quantityUnit: true,
          gramsEstimate: true,
          calories: true,
          proteinGrams: true,
          carbGrams: true,
          fatGrams: true,
          fiberGrams: true,
        },
      },
    },
  });

  if (!meal) {
    return null;
  }

  const items: MealEditorItem[] = meal.items.map((item) => ({
    quantityAmount: item.quantityAmount ? item.quantityAmount.toNumber() : null,
    quantityUnit: item.quantityUnit,
    gramsEstimate:
      item.gramsEstimate?.toNumber() ??
      estimateGramsFromPortion(item.quantityAmount ? item.quantityAmount.toNumber() : null, item.quantityUnit, item.displayName),
    id: item.id,
    displayName: item.displayName,
    calories: decimalToNumber(item.calories),
    proteinGrams: decimalToNumber(item.proteinGrams),
    carbGrams: decimalToNumber(item.carbGrams),
    fatGrams: decimalToNumber(item.fatGrams),
    fiberGrams: decimalToNumber(item.fiberGrams),
  }));

  return {
    mealId: meal.id,
    status: meal.status,
    dayKey: getAppDayKey(meal.mealDate),
    dateLabel: formatDateInAppTimeZone(meal.mealDate),
    title: meal.title ?? 'Öğün',
    mealType: meal.mealType,
    consumedTime: formatTimeInputInAppTimeZone(meal.consumedAt),
    notes: meal.notes,
    items,
    totals: sumEditorItems(items),
  };
}

export async function updateOwnedFinalMeal(userId: string, mealId: string, input: FinalMealUpdateInput): Promise<UpdateOwnedFinalMealResult> {
  const existingMeal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existingMeal) {
    return {
      ok: false,
      code: 'not_found',
      message: 'Bu öğün hesabında bulunamadı.',
    };
  }

  if (existingMeal.status !== 'CONFIRMED') {
    return {
      ok: false,
      code: 'conflict',
      message: 'Burada sadece onaylı öğünler düzenlenebilir. Taslak öğünleri taslak akışından yönet.',
    };
  }

  const consumedAt = getAppDateTimeFromDayKeyAndTime(input.dayKey, input.consumedTime);
  const mealDate = getAppDayDateFromDayKey(input.dayKey);

  await prisma.$transaction(async (tx) => {
    await tx.meal.update({
      where: {
        id: existingMeal.id,
      },
      data: {
        title: normalizeOptionalText(input.title),
        mealType: input.mealType,
        notes: normalizeOptionalText(input.notes),
        timeZone: 'Europe/Istanbul',
        mealDate,
        consumedAt,
      },
    });

    await tx.mealItem.deleteMany({
      where: {
        mealId: existingMeal.id,
      },
    });

    await tx.mealItem.createMany({
      data: buildMealItemCreateInputs(existingMeal.id, input.items),
    });
  });

  return {
    ok: true,
    mealId: existingMeal.id,
    redirectTo: input.dayKey === getAppDayKey(new Date()) ? '/app' : `/app?day=${input.dayKey}`,
  };
}
