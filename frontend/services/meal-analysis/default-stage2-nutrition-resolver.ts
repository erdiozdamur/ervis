import type { PrismaClient } from '@prisma/client';
import { getServerEnv } from '@/lib/env';
import type { MealAnalysisContext, MealAnalysisStage2NutritionResolver } from '@/services/meal-analysis/contracts';
import { createFoodCatalogSlug, estimateHeuristicMacros } from '@/services/meal-analysis/heuristics';
import type { MealStage1Estimate, MealStage2ResolvedItem } from '@/types/meal-analysis';
import {
  buildNutritionCacheKey,
  hasCompleteMacros,
  roundNumericValue,
  resolveFoodNormalization,
  scaleResolvedMacros,
  scoreFoodCatalogEntryMatch,
  toResolvedMacros,
  type PersistableCacheShape,
} from '@/services/meal-analysis/shared-nutrition';

const SHARED_CATALOG_MATCH_THRESHOLD = 0.94;

async function touchCacheEntry(db: PrismaClient, cacheKey: string) {
  await db.nutritionCacheEntry.update({
    where: { cacheKey },
    data: {
      lastUsedAt: new Date(),
    },
  });
}

async function upsertSharedCache(db: PrismaClient, data: PersistableCacheShape) {
  return db.nutritionCacheEntry.upsert({
    where: {
      cacheKey: data.cacheKey,
    },
    update: {
      source: data.source,
      provider: data.provider,
      normalizedFoodEntryId: data.normalizedFoodEntryId,
      servingAmount: data.servingAmount,
      servingUnit: data.servingUnit,
      calories: roundNumericValue(data.calories),
      proteinGrams: roundNumericValue(data.proteinGrams),
      carbGrams: roundNumericValue(data.carbGrams),
      fatGrams: roundNumericValue(data.fatGrams),
      fiberGrams: roundNumericValue(data.fiberGrams),
      payloadJson: data.payloadJson,
      lastUsedAt: new Date(),
    },
    create: {
      ...data,
      calories: roundNumericValue(data.calories),
      proteinGrams: roundNumericValue(data.proteinGrams),
      carbGrams: roundNumericValue(data.carbGrams),
      fatGrams: roundNumericValue(data.fatGrams),
      fiberGrams: roundNumericValue(data.fiberGrams),
      lastUsedAt: new Date(),
    },
    select: {
      id: true,
    },
  });
}

async function findSharedCatalogMatch(
  db: PrismaClient,
  normalization: ReturnType<typeof resolveFoodNormalization>,
) {
  const candidates = await db.foodCatalogEntry.findMany({
    where: {
      OR: [
        ...normalization.searchSlugs.map((slug) => ({ slug })),
        ...normalization.searchNames.map((canonicalName) => ({ canonicalName })),
      ],
    },
    select: {
      id: true,
      slug: true,
      canonicalName: true,
      brandName: true,
      source: true,
      defaultServingAmount: true,
      defaultServingUnit: true,
      calories: true,
      proteinGrams: true,
      carbGrams: true,
      fatGrams: true,
      fiberGrams: true,
    },
    take: 6,
  });

  const scored = candidates
    .map((entry) => ({
      entry,
      score: Math.max(scoreFoodCatalogEntryMatch(normalization.normalizedQuery, entry), entry.slug === normalization.canonicalSlug ? 0.96 : 0),
    }))
    .filter((candidateScore) => candidateScore.score >= SHARED_CATALOG_MATCH_THRESHOLD && hasCompleteMacros(candidateScore.entry))
    .sort((left, right) => right.score - left.score)[0];

  return scored ?? null;
}

export class DefaultMealStage2NutritionResolver implements MealAnalysisStage2NutritionResolver {
  provider = 'shared-nutrition-stage2';
  model = getServerEnv().MEAL_ANALYSIS_STAGE2_MODEL;

  async resolve(context: MealAnalysisContext, estimate: MealStage1Estimate, db: PrismaClient) {
    const warnings = [...estimate.warnings];
    const resolvedItems: MealStage2ResolvedItem[] = [];

    for (const item of estimate.estimatedItems) {
      const normalization = resolveFoodNormalization(item.normalizedQuery);
      const cacheKey = buildNutritionCacheKey(normalization.cacheIdentity, item.quantityMultiplier);
      const cached = await db.nutritionCacheEntry.findUnique({
        where: { cacheKey },
        select: {
          id: true,
          normalizedFoodEntryId: true,
          calories: true,
          proteinGrams: true,
          carbGrams: true,
          fatGrams: true,
          fiberGrams: true,
        },
      });

      if (cached) {
        await touchCacheEntry(db, cacheKey);

        resolvedItems.push({
          id: item.id,
          displayName: item.displayName,
          normalizedQuery: item.normalizedQuery,
          quantityText: item.quantityText,
          quantityMultiplier: item.quantityMultiplier,
          gramsEstimate: item.gramsEstimate ?? null,
          sourceAssetIds: item.sourceAssetIds,
          confidence: item.confidence,
          unresolved: item.unresolved,
          reasoning: `${item.reasoning} Nutrition reused from shared cache.`,
          nutritionSource: 'CACHE',
          nutritionCacheEntryId: cached.id,
          normalizedFoodEntryId: cached.normalizedFoodEntryId,
          resolutionMetadata: {
            method: 'shared_cache',
            matchConfidence: 1,
            matchedKeyword: normalization.matchedKeyword,
          },
          macros: toResolvedMacros(cached),
        });

        continue;
      }

      const sharedCatalogMatch = await findSharedCatalogMatch(db, normalization);

      if (sharedCatalogMatch) {
        const scaledMacros = scaleResolvedMacros(toResolvedMacros(sharedCatalogMatch.entry), item.quantityMultiplier);
        const createdCacheEntry = await upsertSharedCache(db, {
          cacheKey,
          normalizedQueryText: normalization.canonicalQuery,
          source: sharedCatalogMatch.entry.source,
          provider: this.provider,
          normalizedFoodEntryId: sharedCatalogMatch.entry.id,
          servingAmount:
            roundNumericValue(Number(sharedCatalogMatch.entry.defaultServingAmount ?? 1) * item.quantityMultiplier),
          servingUnit: sharedCatalogMatch.entry.defaultServingUnit ?? item.quantityText ?? 'portion',
          calories: scaledMacros.calories,
          proteinGrams: scaledMacros.proteinGrams,
          carbGrams: scaledMacros.carbGrams,
          fatGrams: scaledMacros.fatGrams,
          fiberGrams: scaledMacros.fiberGrams,
          payloadJson: {
            resolutionMethod: 'shared_catalog',
            resolvedBy: this.provider,
            resolvedAt: new Date().toISOString(),
            matchConfidence: sharedCatalogMatch.score,
            matchedKeyword: normalization.matchedKeyword,
            normalizedFoodEntryId: sharedCatalogMatch.entry.id,
            catalogSlug: sharedCatalogMatch.entry.slug,
            cacheIdentity: normalization.cacheIdentity,
            normalizationStrategy: normalization.strategy,
            removedDescriptors: normalization.removedDescriptors,
            contextMealId: context.mealId,
            reasoning: `Resolved from shared food catalog entry "${sharedCatalogMatch.entry.canonicalName}".`,
          },
        });

        resolvedItems.push({
          id: item.id,
          displayName: item.displayName,
          normalizedQuery: item.normalizedQuery,
          quantityText: item.quantityText,
          quantityMultiplier: item.quantityMultiplier,
          gramsEstimate: item.gramsEstimate ?? null,
          sourceAssetIds: item.sourceAssetIds,
          confidence: Math.min(0.98, Math.max(item.confidence, sharedCatalogMatch.score)),
          unresolved: item.unresolved,
          reasoning: `${item.reasoning} Nutrition matched from shared food catalog.`,
          nutritionSource: 'CATALOG',
          nutritionCacheEntryId: createdCacheEntry.id,
          normalizedFoodEntryId: sharedCatalogMatch.entry.id,
          resolutionMetadata: {
            method: 'shared_catalog',
            matchConfidence: sharedCatalogMatch.score,
            matchedKeyword: normalization.matchedKeyword,
          },
          macros: scaledMacros,
        });

        continue;
      }

      const heuristic = estimateHeuristicMacros(normalization.normalizedQuery, item.quantityMultiplier);

      const createdCacheEntry = await upsertSharedCache(db, {
        cacheKey,
        normalizedQueryText: normalization.canonicalQuery,
        source: 'AI_ESTIMATE',
        provider: this.provider,
        normalizedFoodEntryId: null,
        servingAmount: roundNumericValue(item.quantityMultiplier),
        servingUnit: item.quantityText ?? 'portion',
        calories: heuristic.macros.calories,
        proteinGrams: heuristic.macros.proteinGrams,
        carbGrams: heuristic.macros.carbGrams,
        fatGrams: heuristic.macros.fatGrams,
        fiberGrams: heuristic.macros.fiberGrams,
        payloadJson: {
          resolutionMethod: 'fresh_analysis',
          resolvedBy: this.provider,
          resolvedAt: new Date().toISOString(),
          matchConfidence: Math.min(normalization.normalizationConfidence, heuristic.confidence),
          matchedKeyword: normalization.matchedKeyword,
          normalizedFoodEntryId: null,
          catalogSlug: normalization.strategy === 'safe_variant_family' ? normalization.canonicalSlug : null,
          cacheIdentity: normalization.cacheIdentity,
          normalizationStrategy: normalization.strategy,
          removedDescriptors: normalization.removedDescriptors,
          contextMealId: context.mealId,
          reasoning: heuristic.reasoning,
        },
      });

      if (item.unresolved) {
        warnings.push(`"${item.displayName}" needs user review because the source was not structured text.`);
      }

      resolvedItems.push({
        id: item.id,
        displayName: item.displayName,
        normalizedQuery: item.normalizedQuery,
        quantityText: item.quantityText,
        quantityMultiplier: item.quantityMultiplier,
        gramsEstimate: item.gramsEstimate ?? null,
        sourceAssetIds: item.sourceAssetIds,
        confidence: Math.min(item.confidence, heuristic.confidence),
        unresolved: item.unresolved,
        reasoning: `${item.reasoning} ${heuristic.reasoning}`,
        nutritionSource: 'FRESH_ANALYSIS',
        nutritionCacheEntryId: createdCacheEntry.id,
        normalizedFoodEntryId: null,
        resolutionMetadata: {
          method: 'fresh_analysis',
          matchConfidence: Math.min(normalization.normalizationConfidence, heuristic.confidence),
          matchedKeyword: normalization.matchedKeyword,
        },
        macros: heuristic.macros,
      });
    }

    return {
      stage: 'stage_2_nutrition_resolution' as const,
      provider: this.provider,
      model: this.model,
      warnings,
      resolvedItems,
    };
  }
}
