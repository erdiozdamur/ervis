import { unstable_noStore as noStore } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';
import {
  formatDateInAppTimeZone,
  formatTimeInAppTimeZone,
  formatTimeInputInAppTimeZone,
  getAppDayDateFromDayKey,
} from '@/lib/date/istanbul';
import { formatMealTypeLabel } from '@/lib/meals/constants';
import type { MealCard, MealDaySummary, MealTotals } from '@/types/meals';

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value ? value.toNumber() : 0;
}

function sumMealItems(
  items: Array<{
    calories: Prisma.Decimal | null;
    proteinGrams: Prisma.Decimal | null;
    carbGrams: Prisma.Decimal | null;
    fatGrams: Prisma.Decimal | null;
  }>,
) {
  return items.reduce<MealTotals>(
    (totals, item) => ({
      calories: totals.calories + decimalToNumber(item.calories),
      proteinGrams: totals.proteinGrams + decimalToNumber(item.proteinGrams),
      carbGrams: totals.carbGrams + decimalToNumber(item.carbGrams),
      fatGrams: totals.fatGrams + decimalToNumber(item.fatGrams),
    }),
    {
      calories: 0,
      proteinGrams: 0,
      carbGrams: 0,
      fatGrams: 0,
    },
  );
}

function toMealCard(
  meal: {
    id: string;
    title: string | null;
    mealType: MealCard['mealType'];
    status: MealCard['status'];
    consumedAt: Date;
    notes: string | null;
    items: Array<{
      displayName?: string | null;
      calories: Prisma.Decimal | null;
      proteinGrams: Prisma.Decimal | null;
      carbGrams: Prisma.Decimal | null;
      fatGrams: Prisma.Decimal | null;
    }>;
  },
): MealCard {
  const totals = sumMealItems(meal.items);

  return {
    id: meal.id,
    title: meal.title || formatMealTypeLabel(meal.mealType),
    previewItemNames: meal.items.map((item) => item.displayName?.trim() ?? '').filter(Boolean),
    mealType: meal.mealType,
    status: meal.status,
    consumedAtLabel: formatTimeInAppTimeZone(meal.consumedAt),
    consumedAtValue: formatTimeInputInAppTimeZone(meal.consumedAt),
    calories: Math.round(totals.calories),
    proteinGrams: Math.round(totals.proteinGrams),
    carbGrams: Math.round(totals.carbGrams),
    fatGrams: Math.round(totals.fatGrams),
    itemCount: meal.items.length,
    notes: meal.notes,
    isDraft: meal.status === 'DRAFT',
  };
}

export async function getMealDaySummary(userId: string, dayKey: string): Promise<MealDaySummary> {
  noStore();

  const mealDate = getAppDayDateFromDayKey(dayKey);

  const [profile, meals] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: {
        dailyCalorieGoal: true,
        macroProteinGrams: true,
        macroCarbGrams: true,
        macroFatGrams: true,
      },
    }),
    prisma.meal.findMany({
      where: {
        userId,
        mealDate,
        status: {
          in: ['DRAFT', 'CONFIRMED'],
        },
      },
      include: {
        items: {
          orderBy: {
            sortOrder: 'asc',
          },
          select: {
            displayName: true,
            calories: true,
            proteinGrams: true,
            carbGrams: true,
            fatGrams: true,
          },
        },
      },
      orderBy: {
        consumedAt: 'asc',
      },
    }),
  ]);

  const mealsWithItems = meals.filter((meal) => meal.items.length > 0);
  const mealCards = mealsWithItems.map(toMealCard).map((meal, index) => ({
    ...meal,
    title: `${index + 1}. öğün`,
  }));
  const consumed = mealCards.reduce<MealTotals>(
    (totals, meal) => ({
      calories: totals.calories + meal.calories,
      proteinGrams: totals.proteinGrams + meal.proteinGrams,
      carbGrams: totals.carbGrams + meal.carbGrams,
      fatGrams: totals.fatGrams + meal.fatGrams,
    }),
    {
      calories: 0,
      proteinGrams: 0,
      carbGrams: 0,
      fatGrams: 0,
    },
  );

  const targetCalories = profile?.dailyCalorieGoal ?? null;
  const targetProtein = profile?.macroProteinGrams ?? null;
  const targetCarbs = profile?.macroCarbGrams ?? null;
  const targetFat = profile?.macroFatGrams ?? null;
  const targets =
    targetCalories != null && targetProtein != null && targetCarbs != null && targetFat != null
      ? {
          calories: targetCalories,
          proteinGrams: targetProtein,
          carbGrams: targetCarbs,
          fatGrams: targetFat,
        }
      : null;

  return {
    dayKey,
    dateLabel: formatDateInAppTimeZone(mealDate),
    targetCalories,
    targets,
    consumed,
    remaining: {
      calories: targetCalories != null ? targetCalories - consumed.calories : null,
      proteinGrams: targetProtein != null ? targetProtein - consumed.proteinGrams : null,
      carbGrams: targetCarbs != null ? targetCarbs - consumed.carbGrams : null,
      fatGrams: targetFat != null ? targetFat - consumed.fatGrams : null,
    },
    mealCount: mealCards.length,
    confirmedMealCount: mealCards.filter((meal) => !meal.isDraft).length,
    hasDraftMeals: mealCards.some((meal) => meal.isDraft),
    meals: mealCards,
  };
}
