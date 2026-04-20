import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '@/db/prisma';
import { getAppDayKey } from '@/lib/date/istanbul';
import { parseDraftPortion } from '@/lib/meals/draft-review';
import { buildConfirmedMealItemsFromDraft, confirmOwnedMealDraft } from '@/services/meals/meal-confirm-service';
import type { MealDraftAnalysisResult } from '@/types/meal-analysis';

test('parseDraftPortion handles Turkish portion text', () => {
  const parsed = parseDraftPortion('yarım porsiyon');

  assert.equal(parsed.quantityAmount, 0.5);
  assert.equal(parsed.quantityUnit, 'porsiyon');
  assert.equal(parsed.quantityMultiplier, 0.5);
});

test('parseDraftPortion keeps gram unit and avoids portion inflation on large naked values', () => {
  const parsedWithGram = parseDraftPortion('400 gram');
  assert.equal(parsedWithGram.quantityAmount, 400);
  assert.equal(parsedWithGram.quantityUnit, 'gram');
  assert.equal(parsedWithGram.quantityMultiplier, 4);

  const parsedCompact = parseDraftPortion('250g');
  assert.equal(parsedCompact.quantityAmount, 250);
  assert.equal(parsedCompact.quantityUnit, 'g');
  assert.equal(parsedCompact.quantityMultiplier, 2.5);

  const parsedLargeWithoutUnit = parseDraftPortion('400');
  assert.equal(parsedLargeWithoutUnit.quantityAmount, 400);
  assert.equal(parsedLargeWithoutUnit.quantityUnit, 'gram');
  assert.equal(parsedLargeWithoutUnit.quantityMultiplier, 4);
});

test('buildConfirmedMealItemsFromDraft maps editable draft items into final meal items', () => {
  const draftResult: MealDraftAnalysisResult = {
    contractVersion: 'meal-draft-result-v1',
    mealId: 'meal_1',
    analysisRunId: 'run_1',
    editable: true,
    mealTypeSuggestion: 'DINNER',
    titleSuggestion: 'Dinner',
    warnings: [],
    totals: {
      calories: 430,
      proteinGrams: 31,
      carbGrams: 18,
      fatGrams: 24,
      fiberGrams: 2,
    },
    stageTrace: {
      stage1: { provider: 'heuristic', model: 'test', warningCount: 0, itemCount: 1 },
      stage2: { provider: 'heuristic', model: 'test', warningCount: 0, itemCount: 1, unresolvedItemCount: 0 },
    },
    generatedAt: new Date().toISOString(),
    items: [
      {
        id: 'item_1',
        displayName: 'Biftek',
        normalizedQuery: 'biftek',
        quantityText: '1 porsiyon',
        quantityMultiplier: 1,
        gramsEstimate: 180,
        sourceAssetIds: ['asset_1'],
        confidence: 1,
        unresolved: false,
        reasoning: 'Adjusted during user review before save.',
        nutritionSource: 'USER_REVIEW',
        nutritionCacheEntryId: null,
        normalizedFoodEntryId: null,
        resolutionMetadata: {
          method: 'user_review',
          matchConfidence: 1,
          matchedKeyword: null,
        },
        macros: {
          calories: 430,
          proteinGrams: 31,
          carbGrams: 18,
          fatGrams: 24,
          fiberGrams: 2,
        },
      },
    ],
  };

  const rows = buildConfirmedMealItemsFromDraft('meal_1', draftResult);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.displayName, 'Biftek');
  assert.equal(rows[0]?.gramsEstimate, 180);
  assert.equal(rows[0]?.quantityAmount, 1);
  assert.equal(rows[0]?.quantityUnit, 'porsiyon');
  assert.equal(rows[0]?.nutritionCacheEntryId, null);
});

test('buildConfirmedMealItemsFromDraft estimates grams when analysis grams are missing', () => {
  const draftResult: MealDraftAnalysisResult = {
    contractVersion: 'meal-draft-result-v1',
    mealId: 'meal_2',
    analysisRunId: 'run_2',
    editable: true,
    mealTypeSuggestion: 'LUNCH',
    titleSuggestion: 'Lunch',
    warnings: [],
    totals: {
      calories: 320,
      proteinGrams: 10,
      carbGrams: 40,
      fatGrams: 12,
      fiberGrams: 3,
    },
    stageTrace: {
      stage1: { provider: 'heuristic', model: 'test', warningCount: 0, itemCount: 1 },
      stage2: { provider: 'heuristic', model: 'test', warningCount: 0, itemCount: 1, unresolvedItemCount: 0 },
    },
    generatedAt: new Date().toISOString(),
    items: [
      {
        id: 'item_2',
        displayName: 'Pilav',
        normalizedQuery: 'pilav',
        quantityText: '2 porsiyon',
        quantityMultiplier: 2,
        gramsEstimate: null,
        sourceAssetIds: ['asset_2'],
        confidence: 0.8,
        unresolved: false,
        reasoning: 'test',
        nutritionSource: 'USER_REVIEW',
        nutritionCacheEntryId: null,
        normalizedFoodEntryId: null,
        resolutionMetadata: {
          method: 'user_review',
          matchConfidence: 1,
          matchedKeyword: null,
        },
        macros: {
          calories: 320,
          proteinGrams: 10,
          carbGrams: 40,
          fatGrams: 12,
          fiberGrams: 3,
        },
      },
    ],
  };

  const rows = buildConfirmedMealItemsFromDraft('meal_2', draftResult);
  assert.equal(rows[0]?.gramsEstimate, 360);
});

test('confirmOwnedMealDraft is idempotent when the meal is already confirmed', async () => {
  const mealDelegate = prisma.meal as unknown as {
    findFirst: (args: { where: { id: string; userId: string } }) => Promise<unknown>;
  };
  const originalFindFirst = mealDelegate.findFirst;

  mealDelegate.findFirst = async () => ({
    id: 'meal_confirmed',
    mealDate: new Date(),
    status: 'CONFIRMED',
    analysisRuns: [],
  });

  try {
    const result = await confirmOwnedMealDraft('user_1', 'meal_confirmed');

    assert.equal(result.ok, true);
    assert.equal(result.ok === true ? result.mealId : null, 'meal_confirmed');
    assert.equal(result.ok === true ? result.redirectTo : null, '/app');
  } finally {
    mealDelegate.findFirst = originalFindFirst;
  }
});

test('confirmOwnedMealDraft persists final meal items inside a transaction', async () => {
  const mealDelegate = prisma.meal as unknown as {
    findFirst: (args: { where: { id: string; userId: string } }) => Promise<unknown>;
  };
  const transactionDelegate = prisma as unknown as {
    $transaction: <T>(callback: (tx: Record<string, unknown>) => Promise<T>) => Promise<T>;
  };
  const originalFindFirst = mealDelegate.findFirst;
  const originalTransaction = transactionDelegate.$transaction;
  let deletedMealId = '';
  let createdItems: Array<Record<string, unknown>> = [];
  let updatedMealStatus = '';

  mealDelegate.findFirst = async () => ({
    id: 'meal_draft',
    mealDate: new Date('2026-04-16T21:00:00.000Z'),
    status: 'DRAFT',
    analysisRuns: [
      {
        draftResultJson: {
          contractVersion: 'meal-draft-result-v1',
          mealId: 'meal_draft',
          analysisRunId: 'run_1',
          editable: true,
          mealTypeSuggestion: 'DINNER',
          titleSuggestion: 'Dinner',
          warnings: [],
          totals: {
            calories: 430,
            proteinGrams: 31,
            carbGrams: 18,
            fatGrams: 24,
            fiberGrams: 2,
          },
          stageTrace: {
            stage1: { provider: 'heuristic', model: 'test', warningCount: 0, itemCount: 1 },
            stage2: { provider: 'heuristic', model: 'test', warningCount: 0, itemCount: 1, unresolvedItemCount: 0 },
          },
          generatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item_1',
              displayName: 'Biftek',
              normalizedQuery: 'biftek',
              quantityText: '1 porsiyon',
              quantityMultiplier: 1,
              gramsEstimate: 180,
              sourceAssetIds: ['asset_1'],
              confidence: 1,
              unresolved: false,
              reasoning: 'Adjusted during user review before save.',
              nutritionSource: 'USER_REVIEW',
              nutritionCacheEntryId: null,
              normalizedFoodEntryId: null,
              resolutionMetadata: {
                method: 'user_review',
                matchConfidence: 1,
                matchedKeyword: null,
              },
              macros: {
                calories: 430,
                proteinGrams: 31,
                carbGrams: 18,
                fatGrams: 24,
                fiberGrams: 2,
              },
            },
          ],
        } satisfies MealDraftAnalysisResult,
      },
    ],
  });

  transactionDelegate.$transaction = async (callback) =>
    callback({
      mealItem: {
        async deleteMany({ where }: { where: { mealId: string } }) {
          deletedMealId = where.mealId;
        },
        async createMany({ data }: { data: Array<Record<string, unknown>> }) {
          createdItems = data;
        },
      },
      meal: {
        async update({ data }: { data: { status: string } }) {
          updatedMealStatus = data.status;
        },
      },
    });

  try {
    const result = await confirmOwnedMealDraft('user_1', 'meal_draft');
    const expectedDayKey = '2026-04-17';
    const expectedRedirect = expectedDayKey === getAppDayKey(new Date()) ? '/app' : `/app?day=${expectedDayKey}`;

    assert.equal(result.ok, true);
    assert.equal(deletedMealId, 'meal_draft');
    assert.equal(createdItems.length, 1);
    assert.equal(createdItems[0]?.displayName, 'Biftek');
    assert.equal(updatedMealStatus, 'CONFIRMED');
    assert.equal(result.ok === true ? result.redirectTo : null, expectedRedirect);
  } finally {
    mealDelegate.findFirst = originalFindFirst;
    transactionDelegate.$transaction = originalTransaction;
  }
});

test('confirmOwnedMealDraft rejects draft results with non-positive total calories', async () => {
  const mealDelegate = prisma.meal as unknown as {
    findFirst: (args: { where: { id: string; userId: string } }) => Promise<unknown>;
  };
  const originalFindFirst = mealDelegate.findFirst;

  mealDelegate.findFirst = async () => ({
    id: 'meal_zero',
    mealDate: new Date(),
    status: 'DRAFT',
    analysisRuns: [
      {
        draftResultJson: {
          contractVersion: 'meal-draft-result-v1',
          mealId: 'meal_zero',
          analysisRunId: 'run_zero',
          editable: true,
          mealTypeSuggestion: 'LUNCH',
          titleSuggestion: 'Lunch',
          warnings: [],
          totals: {
            calories: 0,
            proteinGrams: 0,
            carbGrams: 0,
            fatGrams: 0,
            fiberGrams: 0,
          },
          stageTrace: {
            stage1: { provider: 'heuristic', model: 'test', warningCount: 0, itemCount: 1 },
            stage2: { provider: 'heuristic', model: 'test', warningCount: 0, itemCount: 1, unresolvedItemCount: 0 },
          },
          generatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item_zero',
              displayName: 'Unknown meal',
              normalizedQuery: 'unknown meal',
              quantityText: '1 porsiyon',
              quantityMultiplier: 1,
              gramsEstimate: null,
              sourceAssetIds: ['asset_1'],
              confidence: 0.2,
              unresolved: true,
              reasoning: 'Invalid zero-calorie draft',
              nutritionSource: 'USER_REVIEW',
              nutritionCacheEntryId: null,
              normalizedFoodEntryId: null,
              resolutionMetadata: {
                method: 'user_review',
                matchConfidence: 1,
                matchedKeyword: null,
              },
              macros: {
                calories: 0,
                proteinGrams: 0,
                carbGrams: 0,
                fatGrams: 0,
                fiberGrams: 0,
              },
            },
          ],
        } satisfies MealDraftAnalysisResult,
      },
    ],
  });

  try {
    const result = await confirmOwnedMealDraft('user_1', 'meal_zero');

    assert.equal(result.ok, false);
    assert.equal(result.ok === false ? result.code : null, 'conflict');
  } finally {
    mealDelegate.findFirst = originalFindFirst;
  }
});
