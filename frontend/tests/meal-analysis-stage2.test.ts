import assert from 'node:assert/strict';
import test from 'node:test';
import { DefaultMealStage2NutritionResolver } from '@/services/meal-analysis/default-stage2-nutrition-resolver';
import { buildNutritionCacheKey, resolveFoodNormalization } from '@/services/meal-analysis/shared-nutrition';

function createFakeDb({
  cacheEntries = [],
  foodEntries = [],
}: {
  cacheEntries?: Array<Record<string, unknown>>;
  foodEntries?: Array<Record<string, unknown>>;
}) {
  const cache = [...cacheEntries];
  const foods = [...foodEntries];

  return {
    nutritionCacheEntry: {
      async findUnique({ where }: { where: { cacheKey: string } }) {
        return cache.find((entry) => entry.cacheKey === where.cacheKey) ?? null;
      },
      async update({ where, data }: { where: { cacheKey?: string; id?: string }; data: Record<string, unknown> }) {
        const match = cache.find((entry) => entry.cacheKey === where.cacheKey || entry.id === where.id);

        if (!match) {
          throw new Error('Cache entry not found.');
        }

        Object.assign(match, data);
        return match;
      },
      async upsert({
        where,
        update,
        create,
        select,
      }: {
        where: { cacheKey: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) {
        const existing = cache.find((entry) => entry.cacheKey === where.cacheKey);

        if (existing) {
          Object.assign(existing, update);
          if (select) {
            return Object.fromEntries(Object.keys(select).map((key) => [key, (existing as Record<string, unknown>)[key]]));
          }

          return existing;
        }

        const created = { id: `cache_${cache.length + 1}`, ...create };
        cache.push(created);

        if (select) {
          return Object.fromEntries(Object.keys(select).map((key) => [key, (created as Record<string, unknown>)[key]]));
        }

        return created;
      },
    },
    foodCatalogEntry: {
      async findMany({
        where,
        take,
      }: {
        where: { OR: Array<Record<string, unknown>> };
        take?: number;
      }) {
        const results = foods.filter((entry) =>
          where.OR.some((clause) => {
            if ('slug' in clause) {
              return entry.slug === clause.slug;
            }

            if ('canonicalName' in clause && typeof clause.canonicalName === 'string') {
              return String(entry.canonicalName).toLowerCase() === clause.canonicalName.toLowerCase();
            }

            return false;
          }),
        );

        return typeof take === 'number' ? results.slice(0, take) : results;
      },
      async upsert({
        where,
        update,
        create,
        select,
      }: {
        where: { slug: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) {
        const existing = foods.find((entry) => entry.slug === where.slug);

        if (existing) {
          Object.assign(existing, update);
          if (select) {
            return Object.fromEntries(Object.keys(select).map((key) => [key, (existing as Record<string, unknown>)[key]]));
          }

          return existing;
        }

        const created = { id: `food_${foods.length + 1}`, ...create };
        foods.push(created);

        if (select) {
          return Object.fromEntries(Object.keys(select).map((key) => [key, (created as Record<string, unknown>)[key]]));
        }

        return created;
      },
    },
    _cache: cache,
    _foods: foods,
  };
}

test('stage 2 reuses shared catalog entries before fresh resolution', async () => {
  const resolver = new DefaultMealStage2NutritionResolver();
  const db = createFakeDb({
    foodEntries: [
      {
        id: 'food_ayran',
        slug: 'yogurt-drink',
        canonicalName: 'Yogurt drink',
        brandName: null,
        source: 'OFFICIAL_DATASET',
        defaultServingAmount: 1,
        defaultServingUnit: 'glass',
        calories: 110,
        proteinGrams: 8,
        carbGrams: 9,
        fatGrams: 4,
        fiberGrams: 0,
      },
    ],
  });

  const result = await resolver.resolve(
    {
      mealId: 'meal_1',
      userId: 'user_1',
      analysisRunId: 'run_1',
      consumedAt: new Date(),
      mealType: 'LUNCH',
      assets: [],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'LUNCH',
      mealTitleSuggestion: 'Lunch draft',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_1',
          displayName: 'Ayran',
          normalizedQuery: 'ayran',
          quantityText: '2 bardak',
          quantityMultiplier: 2,
          sourceAssetIds: ['asset_1'],
          confidence: 0.9,
          unresolved: false,
          reasoning: 'Derived from transcript.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems[0]?.nutritionSource, 'CATALOG');
  assert.equal(result.resolvedItems[0]?.macros.calories, 220);
  assert.equal(result.resolvedItems[0]?.normalizedFoodEntryId, 'food_ayran');
  assert.equal(result.resolvedItems[0]?.resolutionMetadata.method, 'shared_catalog');
  assert.equal(db._cache.length, 1);
});

test('stage 2 stores fresh analysis output for future reuse when no shared match exists', async () => {
  const resolver = new DefaultMealStage2NutritionResolver();
  const db = createFakeDb({});

  const result = await resolver.resolve(
    {
      mealId: 'meal_2',
      userId: 'user_2',
      analysisRunId: 'run_2',
      consumedAt: new Date(),
      mealType: 'DINNER',
      assets: [],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'DINNER',
      mealTitleSuggestion: 'Dinner draft',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_2',
          displayName: 'Chicken wrap',
          normalizedQuery: 'chicken wrap',
          quantityText: '1 porsiyon',
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_2'],
          confidence: 0.88,
          unresolved: false,
          reasoning: 'Derived from typed text.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems[0]?.nutritionSource, 'FRESH_ANALYSIS');
  assert.equal(result.resolvedItems[0]?.nutritionCacheEntryId, 'cache_1');
  assert.equal(result.resolvedItems[0]?.resolutionMetadata.method, 'fresh_analysis');
  assert.equal(db._cache[0]?.cacheKey, buildNutritionCacheKey('chicken wrap', 1));
  assert.equal(db._foods.length, 0);
});

test('resolveFoodNormalization safely canonicalizes strong food variants', () => {
  const normalization = resolveFoodNormalization('ızgara biftek');

  assert.equal(normalization.strategy, 'safe_variant_family');
  assert.equal(normalization.cacheIdentity, 'beef-steak');
  assert.equal(normalization.canonicalQuery, 'beef steak');
  assert.equal(normalization.matchedKeyword, 'ızgara biftek');
});

test('stage 2 reuses shared cache across safe food variants', async () => {
  const resolver = new DefaultMealStage2NutritionResolver();
  const db = createFakeDb({
    cacheEntries: [
      {
        id: 'cache_steak',
        cacheKey: buildNutritionCacheKey('beef-steak', 1),
        normalizedFoodEntryId: 'food_steak',
        calories: 271,
        proteinGrams: 26,
        carbGrams: 0,
        fatGrams: 18,
        fiberGrams: 0,
      },
    ],
  });

  const result = await resolver.resolve(
    {
      mealId: 'meal_3',
      userId: 'user_3',
      analysisRunId: 'run_3',
      consumedAt: new Date(),
      mealType: 'DINNER',
      assets: [],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'DINNER',
      mealTitleSuggestion: 'Dinner draft',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_3',
          displayName: 'Izgara biftek',
          normalizedQuery: 'ızgara biftek',
          quantityText: '1 porsiyon',
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_3'],
          confidence: 0.9,
          unresolved: false,
          reasoning: 'Derived from typed text.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems[0]?.nutritionSource, 'CACHE');
  assert.equal(result.resolvedItems[0]?.nutritionCacheEntryId, 'cache_steak');
  assert.equal(result.resolvedItems[0]?.resolutionMetadata.matchedKeyword, 'ızgara biftek');
});
