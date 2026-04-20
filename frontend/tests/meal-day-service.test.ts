import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { getAppDayKey } from '@/lib/date/istanbul';
import { getMealDaySummary } from '@/services/meals/meal-day-service';

test('getMealDaySummary calculates daily totals and keeps signed remaining values', async () => {
  const profileDelegate = prisma.userProfile as unknown as {
    findUnique: (args: { where: { userId: string } }) => Promise<unknown>;
  };
  const mealDelegate = prisma.meal as unknown as {
    findMany: (args: Record<string, unknown>) => Promise<unknown>;
  };
  const originalFindUnique = profileDelegate.findUnique;
  const originalFindMany = mealDelegate.findMany;

  profileDelegate.findUnique = async () => ({
    dailyCalorieGoal: 2000,
    macroProteinGrams: 150,
    macroCarbGrams: 180,
    macroFatGrams: 70,
  });
  mealDelegate.findMany = async () => [
    {
      id: 'meal_1',
      title: 'Lunch',
      mealType: 'LUNCH',
      status: 'CONFIRMED',
      consumedAt: new Date('2026-04-17T09:30:00.000Z'),
      notes: null,
      items: [
        {
          displayName: 'Kuru fasulye',
          calories: new Prisma.Decimal(650),
          proteinGrams: new Prisma.Decimal(60),
          carbGrams: new Prisma.Decimal(50),
          fatGrams: new Prisma.Decimal(20),
        },
      ],
    },
    {
      id: 'meal_2',
      title: 'Dinner draft',
      mealType: 'DINNER',
      status: 'DRAFT',
      consumedAt: new Date('2026-04-17T17:15:00.000Z'),
      notes: null,
      items: [
        {
          displayName: 'Pilav',
          calories: new Prisma.Decimal(1450),
          proteinGrams: new Prisma.Decimal(100),
          carbGrams: new Prisma.Decimal(160),
          fatGrams: new Prisma.Decimal(55),
        },
      ],
    },
  ];

  try {
    const summary = await getMealDaySummary('user_1', '2026-04-17');

    assert.equal(summary.consumed.calories, 2100);
    assert.equal(summary.consumed.proteinGrams, 160);
    assert.equal(summary.consumed.carbGrams, 210);
    assert.equal(summary.consumed.fatGrams, 75);
    assert.equal(summary.remaining.calories, -100);
    assert.equal(summary.remaining.proteinGrams, -10);
    assert.equal(summary.remaining.carbGrams, -30);
    assert.equal(summary.remaining.fatGrams, -5);
    assert.equal(summary.mealCount, 2);
    assert.equal(summary.confirmedMealCount, 1);
    assert.equal(summary.hasDraftMeals, true);
    assert.equal(summary.meals[0]?.title, '1. öğün');
    assert.equal(summary.meals[1]?.title, '2. öğün');
    assert.deepEqual(summary.meals[0]?.previewItemNames, ['Kuru fasulye']);
    assert.deepEqual(summary.meals[1]?.previewItemNames, ['Pilav']);
  } finally {
    profileDelegate.findUnique = originalFindUnique;
    mealDelegate.findMany = originalFindMany;
  }
});

test('getMealDaySummary queries meals by the requested Istanbul-local day key', async () => {
  const profileDelegate = prisma.userProfile as unknown as {
    findUnique: (args: { where: { userId: string } }) => Promise<unknown>;
  };
  const mealDelegate = prisma.meal as unknown as {
    findMany: (args: { where: { mealDate: Date } }) => Promise<unknown>;
  };
  const originalFindUnique = profileDelegate.findUnique;
  const originalFindMany = mealDelegate.findMany;
  let queriedMealDate: Date | null = null;

  profileDelegate.findUnique = async () => null;
  mealDelegate.findMany = async ({ where }) => {
    queriedMealDate = where.mealDate;
    return [];
  };

  try {
    await getMealDaySummary('user_2', '2026-04-17');
    if (!queriedMealDate) {
      throw new Error('Expected prisma.meal.findMany to receive a mealDate.');
    }

    assert.equal(getAppDayKey(queriedMealDate), '2026-04-17');
  } finally {
    profileDelegate.findUnique = originalFindUnique;
    mealDelegate.findMany = originalFindMany;
  }
});
