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
      mealTitleSuggestion: 'Öğle yemeği',
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
  class TestStage2Resolver extends DefaultMealStage2NutritionResolver {
    protected override async resolveFreshNutritionWithProvider(_input: Parameters<DefaultMealStage2NutritionResolver['resolveFreshNutritionWithProvider']>[0]) {
      return {
        canonicalName: 'Chicken wrap',
        servingSummary: '1 wrap',
        gramsEstimate: 260,
        confidence: 0.86,
        reasoning: 'Resolved from model output.',
        macros: {
          calories: 520,
          proteinGrams: 28,
          carbGrams: 44,
          fatGrams: 24,
          fiberGrams: 4,
        },
        diagnostics: {
          responseId: null,
          responseStatus: null,
          structuredOutputFound: true,
          outputTextPreview: null,
        },
      };
    }
  }

  const resolver = new TestStage2Resolver();
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
      mealTitleSuggestion: 'Akşam yemeği',
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
  assert.equal(result.resolvedItems[0]?.macros.calories, 520);
  assert.equal(db._cache[0]?.cacheKey, buildNutritionCacheKey('chicken wrap', 1));
  assert.equal(db._foods.length, 0);
});

test('stage 2 keeps generic fallback photo items reviewable instead of renaming them to a guessed food', async () => {
  class TestStage2Resolver extends DefaultMealStage2NutritionResolver {
    protected override async resolveFreshNutritionWithProvider(_input: Parameters<DefaultMealStage2NutritionResolver['resolveFreshNutritionWithProvider']>[0]) {
      return {
        canonicalName: 'Izgara köfte',
        servingSummary: '3 adet',
        gramsEstimate: 180,
        confidence: 0.84,
        reasoning: 'Resolved from model output.',
        macros: {
          calories: 420,
          proteinGrams: 32,
          carbGrams: 10,
          fatGrams: 28,
          fiberGrams: 1,
        },
        diagnostics: {
          responseId: null,
          responseStatus: null,
          structuredOutputFound: true,
          outputTextPreview: null,
        },
      };
    }
  }

  const resolver = new TestStage2Resolver();
  const db = createFakeDb({});

  const result = await resolver.resolve(
    {
      mealId: 'meal_5',
      userId: 'user_5',
      analysisRunId: 'run_5',
      consumedAt: new Date(),
      mealType: 'DINNER',
      assets: [
        {
          id: 'asset_5',
          assetType: 'IMAGE',
          source: 'upload',
          textContent: null,
          mimeType: 'image/jpeg',
          storageKey: 'uploads/test.jpg',
          labelHint: 'images (1).jpeg',
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'DINNER',
      mealTitleSuggestion: 'Akşam yemeği',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_5',
          displayName: 'Fotoğraftaki öğün',
          normalizedQuery: 'fotoğraftaki öğün',
          quantityText: null,
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_5'],
          confidence: 0.4,
          unresolved: true,
          reasoning: 'Görsel ayrıştırma tamamlanamadı. Bu yüzden görsel tek öğelik inceleme taslağına indirildi.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems.length, 1);
  assert.equal(result.resolvedItems[0]?.displayName, 'Fotoğraftaki öğün');
  assert.equal(result.resolvedItems[0]?.quantityText, '3 adet');
  assert.equal(result.resolvedItems[0]?.normalizedQuery, 'fotoğraftaki öğün');
  assert.equal(
    result.warnings.some((warning) => warning.includes('besin adı otomatik netleştirilmedi')),
    true,
  );
});

test('stage 2 falls back to heuristic values when live nutrition resolution is unavailable', async () => {
  class FailingStage2Resolver extends DefaultMealStage2NutritionResolver {
    protected override resolveFreshNutritionWithProvider(
      input: Parameters<DefaultMealStage2NutritionResolver['resolveFreshNutritionWithProvider']>[0],
    ): Promise<never> {
      void input;
      return Promise.reject(new Error('provider unavailable'));
    }
  }

  const resolver = new FailingStage2Resolver();
  const db = createFakeDb({});

  const result = await resolver.resolve(
    {
      mealId: 'meal_4',
      userId: 'user_4',
      analysisRunId: 'run_4',
      consumedAt: new Date(),
      mealType: 'DINNER',
      assets: [],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'DINNER',
      mealTitleSuggestion: 'Akşam yemeği',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_4',
          displayName: 'Unknown meal',
          normalizedQuery: 'unknown meal',
          quantityText: '1 porsiyon',
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_4'],
          confidence: 0.5,
          unresolved: true,
          reasoning: 'Derived from weak input.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems.length, 1);
  assert.equal(result.resolvedItems[0]?.nutritionSource, 'FRESH_ANALYSIS');
  assert.equal(result.resolvedItems[0]?.resolutionMetadata.method, 'fresh_analysis');
  assert.equal(result.resolvedItems[0]?.macros.calories, 240);
  assert.equal(result.warnings.some((warning) => warning.includes('canlı çözümleme başarısız')), true);
});

test('stage 2 falls back to heuristic macros when live resolver returns authentication/configuration errors', async () => {
  class AuthFailingStage2Resolver extends DefaultMealStage2NutritionResolver {
    protected override resolveFreshNutritionWithProvider(
      input: Parameters<DefaultMealStage2NutritionResolver['resolveFreshNutritionWithProvider']>[0],
    ): Promise<never> {
      void input;
      return Promise.reject(new Error('Incorrect API key provided.'));
    }
  }

  const resolver = new AuthFailingStage2Resolver();
  const db = createFakeDb({});

  const result = await resolver.resolve(
    {
      mealId: 'meal_auth_fail',
      userId: 'user_auth_fail',
      analysisRunId: 'run_auth_fail',
      consumedAt: new Date(),
      mealType: 'DINNER',
      assets: [],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'DINNER',
      mealTitleSuggestion: 'Akşam yemeği',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_auth_fail',
          displayName: 'Qzzx unknown',
          normalizedQuery: 'qzzx unknown',
          quantityText: '1 tabak',
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_auth_fail'],
          confidence: 0.4,
          unresolved: true,
          reasoning: 'Derived from weak image fallback.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems.length, 1);
  assert.equal(result.resolvedItems[0]?.macros.calories, 240);
  assert.equal(result.warnings.some((warning) => warning.includes('OpenAI API anahtarı geçersiz')), true);
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
      mealTitleSuggestion: 'Akşam yemeği',
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

test('stage 2 resolves known branded menu items from local shared catalog when live provider is unavailable', async () => {
  const resolver = new DefaultMealStage2NutritionResolver();
  const db = createFakeDb({});

  const result = await resolver.resolve(
    {
      mealId: 'meal_5',
      userId: 'user_5',
      analysisRunId: 'run_5',
      consumedAt: new Date(),
      mealType: 'LUNCH',
      assets: [],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'LUNCH',
      mealTitleSuggestion: 'Öğle yemeği',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_5',
          displayName: 'Big mac menü',
          normalizedQuery: 'big mac menü',
          quantityText: '1 menü',
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_5'],
          confidence: 0.8,
          unresolved: false,
          reasoning: 'Derived from typed text.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems[0]?.nutritionSource, 'CATALOG');
  assert.equal(result.resolvedItems[0]?.resolutionMetadata.method, 'shared_catalog');
  assert.ok((result.resolvedItems[0]?.macros.calories ?? 0) > 0);
});

test('stage 2 replaces placeholder names with Turkish catalog names', async () => {
  const resolver = new DefaultMealStage2NutritionResolver();
  const db = createFakeDb({
    foodEntries: [
      {
        id: 'food_rice',
        slug: 'rice-pilaf',
        canonicalName: 'Rice pilaf',
        brandName: null,
        source: 'OFFICIAL_DATASET',
        defaultServingAmount: 1,
        defaultServingUnit: 'plate',
        calories: 205,
        proteinGrams: 4,
        carbGrams: 45,
        fatGrams: 0,
        fiberGrams: 1,
      },
    ],
  });

  const result = await resolver.resolve(
    {
      mealId: 'meal_tr_catalog',
      userId: 'user_tr_catalog',
      analysisRunId: 'run_tr_catalog',
      consumedAt: new Date(),
      mealType: 'DINNER',
      assets: [],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'DINNER',
      mealTitleSuggestion: 'Akşam yemeği',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_tr_catalog',
          displayName: 'Fotoğraftaki tabak',
          normalizedQuery: 'pilav',
          quantityText: '1 porsiyon',
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_tr_catalog'],
          confidence: 0.45,
          unresolved: true,
          reasoning: 'Derived from weak image fallback.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems[0]?.displayName, 'Pilav');
  assert.equal(result.resolvedItems[0]?.normalizedQuery, 'pilav');
});

test('stage 2 skips shared catalog promotion for generic fallback photo items', async () => {
  const resolver = new DefaultMealStage2NutritionResolver();
  const db = createFakeDb({
    foodEntries: [
      {
        id: 'food_salad',
        slug: 'salad',
        canonicalName: 'Salad',
        brandName: null,
        source: 'OFFICIAL_DATASET',
        defaultServingAmount: 1,
        defaultServingUnit: 'plate',
        calories: 880,
        proteinGrams: 18,
        carbGrams: 125,
        fatGrams: 30,
        fiberGrams: 12,
      },
    ],
  });

  const result = await resolver.resolve(
    {
      mealId: 'meal_generic_photo_catalog',
      userId: 'user_generic_photo_catalog',
      analysisRunId: 'run_generic_photo_catalog',
      consumedAt: new Date(),
      mealType: 'DINNER',
      assets: [
        {
          id: 'asset_generic_photo_catalog',
          assetType: 'IMAGE',
          source: 'upload',
          textContent: null,
          mimeType: 'image/jpeg',
          storageKey: 'uploads/photo.jpg',
          labelHint: 'IMG_9999.jpg',
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'DINNER',
      mealTitleSuggestion: 'Akşam yemeği',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_generic_photo_catalog',
          displayName: 'Fotoğraftaki öğün',
          normalizedQuery: 'salata',
          quantityText: '1 tabak',
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_generic_photo_catalog'],
          confidence: 0.34,
          unresolved: true,
          reasoning: 'Görsel ayrıştırma tamamlanamadı. Bu yüzden görsel tek öğelik inceleme taslağına indirildi.',
        },
      ],
    },
    db as never,
  );

  assert.notEqual(result.resolvedItems[0]?.nutritionSource, 'CATALOG');
  assert.equal(result.resolvedItems[0]?.displayName, 'Fotoğraftaki öğün');
});

test('stage 2 skips shared cache reuse for generic fallback photo items', async () => {
  const resolver = new DefaultMealStage2NutritionResolver();
  const db = createFakeDb({
    cacheEntries: [
      {
        id: 'cache_generic_photo',
        cacheKey: buildNutritionCacheKey('fotoğraftaki öğün', 1),
        normalizedFoodEntryId: null,
        calories: 880,
        proteinGrams: 18,
        carbGrams: 125,
        fatGrams: 30,
        fiberGrams: 12,
      },
    ],
  });

  const result = await resolver.resolve(
    {
      mealId: 'meal_generic_photo_cache',
      userId: 'user_generic_photo_cache',
      analysisRunId: 'run_generic_photo_cache',
      consumedAt: new Date(),
      mealType: 'DINNER',
      assets: [
        {
          id: 'asset_generic_photo_cache',
          assetType: 'IMAGE',
          source: 'upload',
          textContent: null,
          mimeType: 'image/jpeg',
          storageKey: 'uploads/photo.jpg',
          labelHint: 'IMG_9999.jpg',
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'DINNER',
      mealTitleSuggestion: 'Akşam yemeği',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_generic_photo_cache',
          displayName: 'Fotoğraftaki öğün',
          normalizedQuery: 'fotoğraftaki öğün',
          quantityText: '1 tabak',
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_generic_photo_cache'],
          confidence: 0.34,
          unresolved: true,
          reasoning: 'Görsel ayrıştırma tamamlanamadı. Bu yüzden görsel tek öğelik inceleme taslağına indirildi.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems[0]?.nutritionSource, 'FRESH_ANALYSIS');
  assert.notEqual(result.resolvedItems[0]?.macros.calories, 880);
});

test('stage 2 does not write shared cache entries for generic fallback photo items', async () => {
  class TestStage2Resolver extends DefaultMealStage2NutritionResolver {
    protected override async resolveFreshNutritionWithProvider(_input: Parameters<DefaultMealStage2NutritionResolver['resolveFreshNutritionWithProvider']>[0]) {
      return {
        canonicalName: 'Karışık tabak',
        servingSummary: '1 tabak',
        gramsEstimate: 420,
        confidence: 0.78,
        reasoning: 'Resolved from current image only.',
        macros: {
          calories: 540,
          proteinGrams: 18,
          carbGrams: 52,
          fatGrams: 26,
          fiberGrams: 7,
        },
        diagnostics: {
          responseId: null,
          responseStatus: null,
          structuredOutputFound: true,
          outputTextPreview: null,
        },
      };
    }
  }

  const resolver = new TestStage2Resolver();
  const db = createFakeDb({});

  const result = await resolver.resolve(
    {
      mealId: 'meal_generic_photo_no_cache_write',
      userId: 'user_generic_photo_no_cache_write',
      analysisRunId: 'run_generic_photo_no_cache_write',
      consumedAt: new Date(),
      mealType: 'DINNER',
      assets: [
        {
          id: 'asset_generic_photo_no_cache_write',
          assetType: 'IMAGE',
          source: 'upload',
          textContent: null,
          mimeType: 'image/jpeg',
          storageKey: 'uploads/photo.jpg',
          labelHint: 'IMG_9999.jpg',
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      stage: 'stage_1_estimation',
      provider: 'heuristic-stage1',
      model: 'test-model',
      mealTypeSuggestion: 'DINNER',
      mealTitleSuggestion: 'Akşam yemeği',
      warnings: [],
      estimatedItems: [
        {
          id: 'item_generic_photo_no_cache_write',
          displayName: 'Fotoğraftaki öğün',
          normalizedQuery: 'fotoğraftaki öğün',
          quantityText: '1 tabak',
          quantityMultiplier: 1,
          sourceAssetIds: ['asset_generic_photo_no_cache_write'],
          confidence: 0.34,
          unresolved: true,
          reasoning: 'Görsel ayrıştırma tamamlanamadı. Bu yüzden görsel tek öğelik inceleme taslağına indirildi.',
        },
      ],
    },
    db as never,
  );

  assert.equal(result.resolvedItems[0]?.nutritionSource, 'FRESH_ANALYSIS');
  assert.equal(result.resolvedItems[0]?.nutritionCacheEntryId, null);
  assert.equal(db._cache.length, 0);
});
