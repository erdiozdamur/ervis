import type { PrismaClient } from '@prisma/client';
import { getServerEnv } from '@/lib/env';
import type { MealAnalysisContext, MealAnalysisStage2NutritionResolver } from '@/services/meal-analysis/contracts';
import { resolveNutritionWithOpenAi } from '@/services/meal-analysis/openai-stage2-nutrition-service';
import type { MealStage1Estimate, MealStage2ResolvedItem } from '@/types/meal-analysis';
import {
  estimateHeuristicMacros,
  localizeFoodDisplayName,
} from '@/services/meal-analysis/heuristics';
import {
  buildNutritionCacheKey,
  getSharedCatalogCandidate,
  hasCompleteMacros,
  roundNumericValue,
  resolveFoodNormalization,
  scaleResolvedMacros,
  shouldPromoteSharedCatalogCandidate,
  scoreFoodCatalogEntryMatch,
  toResolvedMacros,
  type PersistableCacheShape,
  type SharedCatalogCandidate,
} from '@/services/meal-analysis/shared-nutrition';

const SHARED_CATALOG_MATCH_THRESHOLD = 0.94;
const LEGACY_FALLBACK_MACROS = {
  calories: 240,
  proteinGrams: 12,
  carbGrams: 22,
  fatGrams: 10,
  fiberGrams: 2,
} as const;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown stage 2 resolver error.';
}

function toUserFacingLiveResolverError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes('incorrect api key')) {
    return 'OpenAI API anahtarı geçersiz.';
  }

  if (normalized.includes('openai_api_key is missing')) {
    return 'OpenAI API anahtarı tanımlı değil.';
  }

  if (normalized.includes('ai_provider is not set to openai')) {
    return 'AI sağlayıcısı OpenAI olarak ayarlı değil.';
  }

  if (normalized.includes('401')) {
    return 'OpenAI yetkilendirme hatası (401).';
  }

  return errorMessage;
}

function looksLikePlaceholderDisplayName(value: string) {
  const normalized = value
    .toLocaleLowerCase('tr-TR')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return true;
  }

  return (
    /^(image|images|img|photo|camera|uploaded image item|plate item from photo|bowl item from photo|drink from photo|snack item from photo|fotoğraftaki tabak|fotoğraftaki kase|fotoğraftaki içecek|fotoğraftaki atıştırmalık)(?:\s*\d+)?$/.test(
      normalized,
    ) || /\.(jpg|jpeg|png|webp|heic|gif|bmp|tiff?)$/.test(normalized)
  );
}

function isGenericImageFallbackItem(
  item: MealStage1Estimate['estimatedItems'][number],
  context: MealAnalysisContext,
) {
  if (!item.unresolved) {
    return false;
  }

  if (!looksLikePlaceholderDisplayName(item.displayName) && item.displayName !== 'Fotoğraftaki öğün') {
    return false;
  }

  const hasImageSource = context.assets.some(
    (asset) => item.sourceAssetIds.includes(asset.id) && asset.assetType === 'IMAGE',
  );

  if (!hasImageSource) {
    return false;
  }

  const normalizedReasoning = item.reasoning.toLocaleLowerCase('tr-TR');
  return (
    normalizedReasoning.includes('tek öğelik inceleme taslağına indirildi') ||
    normalizedReasoning.includes('weak image fallback') ||
    normalizedReasoning.includes('fotoğraf etiketi çözümlemesinden')
  );
}

function isLegacyFallbackCacheEntry(values: {
  calories: number | null;
  proteinGrams: number | null;
  carbGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
}) {
  return (
    values.calories === LEGACY_FALLBACK_MACROS.calories &&
    values.proteinGrams === LEGACY_FALLBACK_MACROS.proteinGrams &&
    values.carbGrams === LEGACY_FALLBACK_MACROS.carbGrams &&
    values.fatGrams === LEGACY_FALLBACK_MACROS.fatGrams &&
    values.fiberGrams === LEGACY_FALLBACK_MACROS.fiberGrams
  );
}

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

async function ensureHeuristicCatalogEntry(db: PrismaClient, candidate: SharedCatalogCandidate) {
  return db.foodCatalogEntry.upsert({
    where: {
      slug: candidate.slug,
    },
    update: {
      canonicalName: candidate.canonicalName,
      source: candidate.source,
      defaultServingAmount: roundNumericValue(candidate.defaultServingAmount ?? 1),
      defaultServingUnit: candidate.defaultServingUnit ?? 'portion',
      calories: roundNumericValue(candidate.macros.calories),
      proteinGrams: roundNumericValue(candidate.macros.proteinGrams),
      carbGrams: roundNumericValue(candidate.macros.carbGrams),
      fatGrams: roundNumericValue(candidate.macros.fatGrams),
      fiberGrams: roundNumericValue(candidate.macros.fiberGrams),
    },
    create: {
      slug: candidate.slug,
      canonicalName: candidate.canonicalName,
      source: candidate.source,
      defaultServingAmount: roundNumericValue(candidate.defaultServingAmount ?? 1),
      defaultServingUnit: candidate.defaultServingUnit ?? 'portion',
      calories: roundNumericValue(candidate.macros.calories),
      proteinGrams: roundNumericValue(candidate.macros.proteinGrams),
      carbGrams: roundNumericValue(candidate.macros.carbGrams),
      fatGrams: roundNumericValue(candidate.macros.fatGrams),
      fiberGrams: roundNumericValue(candidate.macros.fiberGrams),
      metadataJson: {
        origin: 'heuristic_catalog_seed',
        matchedKeyword: candidate.matchedKeyword,
      },
    },
    select: {
      id: true,
      canonicalName: true,
      slug: true,
      source: true,
      defaultServingAmount: true,
      defaultServingUnit: true,
      calories: true,
      proteinGrams: true,
      carbGrams: true,
      fatGrams: true,
      fiberGrams: true,
    },
  });
}

export class DefaultMealStage2NutritionResolver implements MealAnalysisStage2NutritionResolver {
  provider = 'shared-nutrition-stage2';
  model = getServerEnv().MEAL_ANALYSIS_STAGE2_MODEL;
  protected async resolveFreshNutritionWithProvider(input: Parameters<typeof resolveNutritionWithOpenAi>[0]) {
    return resolveNutritionWithOpenAi(input);
  }

  async resolve(context: MealAnalysisContext, estimate: MealStage1Estimate, db: PrismaClient) {
    const warnings = [...estimate.warnings];
    const resolvedItems: MealStage2ResolvedItem[] = [];
    let stage2Diagnostics:
      | {
          responseId: string | null;
          responseStatus: string | null;
          structuredOutputFound: boolean;
          outputTextPreview: string | null;
          canonicalName: string | null;
          gramsEstimate: number | null;
          genericPhotoPlaceholder: boolean;
          usedImageContext: boolean;
        }
      | null = null;

    for (const item of estimate.estimatedItems) {
      const genericImageFallbackItem = isGenericImageFallbackItem(item, context);
      const normalization = resolveFoodNormalization(item.normalizedQuery);
      const cacheKey = buildNutritionCacheKey(normalization.cacheIdentity, item.quantityMultiplier);
      const cached = genericImageFallbackItem
        ? null
        : await db.nutritionCacheEntry.findUnique({
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

      if (cached && !isLegacyFallbackCacheEntry(toResolvedMacros(cached))) {
        await touchCacheEntry(db, cacheKey);
        stage2Diagnostics = {
          responseId: null,
          responseStatus: 'cache_hit',
          structuredOutputFound: false,
          outputTextPreview: null,
          canonicalName: item.displayName,
          gramsEstimate: item.gramsEstimate ?? null,
          genericPhotoPlaceholder: genericImageFallbackItem,
          usedImageContext: context.assets.some((asset) => asset.assetType === 'IMAGE'),
        };

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

      const sharedCatalogMatch = genericImageFallbackItem ? null : await findSharedCatalogMatch(db, normalization);

      if (sharedCatalogMatch) {
        const scaledMacros = scaleResolvedMacros(toResolvedMacros(sharedCatalogMatch.entry), item.quantityMultiplier);
        const resolvedCatalogDisplayName =
          looksLikePlaceholderDisplayName(item.displayName) || !item.displayName.trim()
            ? localizeFoodDisplayName(sharedCatalogMatch.entry.canonicalName)
            : item.displayName;
        stage2Diagnostics = {
          responseId: null,
          responseStatus: 'shared_catalog',
          structuredOutputFound: false,
          outputTextPreview: null,
          canonicalName: resolvedCatalogDisplayName,
          gramsEstimate: item.gramsEstimate ?? null,
          genericPhotoPlaceholder: genericImageFallbackItem,
          usedImageContext: context.assets.some((asset) => asset.assetType === 'IMAGE'),
        };
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
          displayName: resolvedCatalogDisplayName,
          normalizedQuery: resolveFoodNormalization(resolvedCatalogDisplayName).normalizedQuery,
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

      const heuristicCandidate = genericImageFallbackItem ? null : getSharedCatalogCandidate(normalization.normalizedQuery);
      if (heuristicCandidate && shouldPromoteSharedCatalogCandidate(normalization.normalizedQuery, heuristicCandidate)) {
        const heuristicCatalogEntry = await ensureHeuristicCatalogEntry(db, heuristicCandidate);
        const scaledMacros = scaleResolvedMacros(toResolvedMacros(heuristicCatalogEntry), item.quantityMultiplier);
        const resolvedCatalogDisplayName =
          looksLikePlaceholderDisplayName(item.displayName) || !item.displayName.trim()
            ? heuristicCandidate.localizedName
            : item.displayName;
        stage2Diagnostics = {
          responseId: null,
          responseStatus: 'heuristic_catalog',
          structuredOutputFound: false,
          outputTextPreview: null,
          canonicalName: resolvedCatalogDisplayName,
          gramsEstimate: item.gramsEstimate ?? null,
          genericPhotoPlaceholder: genericImageFallbackItem,
          usedImageContext: context.assets.some((asset) => asset.assetType === 'IMAGE'),
        };
        const createdCacheEntry = await upsertSharedCache(db, {
          cacheKey,
          normalizedQueryText: normalization.canonicalQuery,
          source: heuristicCatalogEntry.source,
          provider: this.provider,
          normalizedFoodEntryId: heuristicCatalogEntry.id,
          servingAmount: roundNumericValue(Number(heuristicCatalogEntry.defaultServingAmount ?? 1) * item.quantityMultiplier),
          servingUnit: heuristicCatalogEntry.defaultServingUnit ?? item.quantityText ?? 'portion',
          calories: scaledMacros.calories,
          proteinGrams: scaledMacros.proteinGrams,
          carbGrams: scaledMacros.carbGrams,
          fatGrams: scaledMacros.fatGrams,
          fiberGrams: scaledMacros.fiberGrams,
          payloadJson: {
            resolutionMethod: 'shared_catalog',
            resolvedBy: this.provider,
            resolvedAt: new Date().toISOString(),
            matchConfidence: heuristicCandidate.confidence,
            matchedKeyword: heuristicCandidate.matchedKeyword,
            normalizedFoodEntryId: heuristicCatalogEntry.id,
            catalogSlug: heuristicCatalogEntry.slug,
            cacheIdentity: normalization.cacheIdentity,
            normalizationStrategy: normalization.strategy,
            removedDescriptors: normalization.removedDescriptors,
            contextMealId: context.mealId,
            reasoning: heuristicCandidate.reasoning,
          },
        });

        resolvedItems.push({
          id: item.id,
          displayName: resolvedCatalogDisplayName,
          normalizedQuery: resolveFoodNormalization(resolvedCatalogDisplayName).normalizedQuery,
          quantityText: item.quantityText,
          quantityMultiplier: item.quantityMultiplier,
          gramsEstimate: item.gramsEstimate ?? null,
          sourceAssetIds: item.sourceAssetIds,
          confidence: Math.min(0.95, Math.max(item.confidence, heuristicCandidate.confidence)),
          unresolved: item.unresolved,
          reasoning: `${item.reasoning} Nutrition resolved from shared local food catalog.`,
          nutritionSource: 'CATALOG',
          nutritionCacheEntryId: createdCacheEntry.id,
          normalizedFoodEntryId: heuristicCatalogEntry.id,
          resolutionMetadata: {
            method: 'shared_catalog',
            matchConfidence: heuristicCandidate.confidence,
            matchedKeyword: heuristicCandidate.matchedKeyword,
          },
          macros: scaledMacros,
        });

        continue;
      }

      let freshResolution:
        | {
            macros: MealStage2ResolvedItem['macros'];
            confidence: number;
            reasoning: string;
            gramsEstimate: number | null;
            canonicalName: string | null;
            servingSummary: string | null;
            diagnostics: {
              responseId: string | null;
              responseStatus: string | null;
              structuredOutputFound: boolean;
              outputTextPreview: string | null;
            } | null;
          }
        | null = null;

      try {
        const aiResolution = await this.resolveFreshNutritionWithProvider({
          item: {
            displayName: item.displayName,
            normalizedQuery: normalization.normalizedQuery,
            quantityText: item.quantityText,
            quantityMultiplier: item.quantityMultiplier,
            reasoning: item.reasoning,
          },
          mealContext: {
            mealType: context.mealType,
            consumedAtIso: context.consumedAt.toISOString(),
            textContext: context.assets
              .filter((asset) => item.sourceAssetIds.includes(asset.id) && Boolean(asset.textContent))
              .map((asset) => asset.textContent as string),
            sourceAssets: context.assets.filter((asset) => item.sourceAssetIds.includes(asset.id)),
          },
        });

        freshResolution = {
          macros: aiResolution.macros,
          confidence: aiResolution.confidence,
          reasoning: aiResolution.reasoning,
          gramsEstimate: aiResolution.gramsEstimate > 0 ? roundNumericValue(aiResolution.gramsEstimate) : null,
          canonicalName: aiResolution.canonicalName.trim() || null,
          servingSummary: aiResolution.servingSummary.trim() || null,
          diagnostics: aiResolution.diagnostics,
        };
      } catch (error) {
        const liveResolutionErrorMessage = getErrorMessage(error);
        const fallbackEstimate = estimateHeuristicMacros(normalization.normalizedQuery, item.quantityMultiplier);
        freshResolution = {
          macros: fallbackEstimate.macros,
          confidence: Math.min(0.62, Math.max(0.35, fallbackEstimate.confidence)),
          reasoning: `Live resolver unavailable, heuristic fallback used. ${fallbackEstimate.reasoning}`,
          gramsEstimate: item.gramsEstimate ?? null,
          canonicalName: null,
          servingSummary: null,
          diagnostics: null,
        };
        warnings.push(`"${item.displayName}" için canlı çözümleme başarısız oldu; tahmini değer kullanıldı. (${toUserFacingLiveResolverError(liveResolutionErrorMessage)})`);
        void error;
      }

      const resolvedDisplayName =
        !genericImageFallbackItem &&
        freshResolution.canonicalName &&
        (item.unresolved || looksLikePlaceholderDisplayName(item.displayName))
          ? localizeFoodDisplayName(freshResolution.canonicalName)
          : item.displayName;
      stage2Diagnostics = {
        responseId: freshResolution.diagnostics?.responseId ?? null,
        responseStatus: freshResolution.diagnostics?.responseStatus ?? 'fresh_analysis',
        structuredOutputFound: freshResolution.diagnostics?.structuredOutputFound ?? false,
        outputTextPreview: freshResolution.diagnostics?.outputTextPreview ?? null,
        canonicalName: freshResolution.canonicalName,
        gramsEstimate: freshResolution.gramsEstimate ?? item.gramsEstimate ?? null,
        genericPhotoPlaceholder: genericImageFallbackItem,
        usedImageContext: context.assets.some((asset) => asset.assetType === 'IMAGE'),
      };
      const resolvedQuantityText = item.quantityText ?? freshResolution.servingSummary ?? null;
      const resolvedNormalizedQuery = resolveFoodNormalization(resolvedDisplayName).normalizedQuery;

      const createdCacheEntry = genericImageFallbackItem
        ? null
        : await upsertSharedCache(db, {
            cacheKey,
            normalizedQueryText: normalization.canonicalQuery,
            source: 'AI_ESTIMATE',
            provider: this.provider,
            normalizedFoodEntryId: null,
            servingAmount: roundNumericValue(item.quantityMultiplier),
            servingUnit: item.quantityText ?? 'portion',
            calories: freshResolution.macros.calories,
            proteinGrams: freshResolution.macros.proteinGrams,
            carbGrams: freshResolution.macros.carbGrams,
            fatGrams: freshResolution.macros.fatGrams,
            fiberGrams: freshResolution.macros.fiberGrams,
            payloadJson: {
              resolutionMethod: 'fresh_analysis',
              resolvedBy: this.provider,
              resolvedAt: new Date().toISOString(),
              matchConfidence: Math.min(normalization.normalizationConfidence || freshResolution.confidence, freshResolution.confidence),
              matchedKeyword: normalization.matchedKeyword,
              normalizedFoodEntryId: null,
              catalogSlug: normalization.strategy === 'safe_variant_family' ? normalization.canonicalSlug : null,
              cacheIdentity: normalization.cacheIdentity,
              normalizationStrategy: normalization.strategy,
              removedDescriptors: normalization.removedDescriptors,
              contextMealId: context.mealId,
              reasoning: freshResolution.reasoning,
            },
          });

      if (item.unresolved) {
        warnings.push(`"${item.displayName}" needs user review because the source was not structured text.`);
      }

      if (genericImageFallbackItem) {
        warnings.push(`"${item.displayName}" görselden tek öğe fallback olarak kaldı; besin adı otomatik netleştirilmedi.`);
      }

      resolvedItems.push({
        id: item.id,
        displayName: resolvedDisplayName,
        normalizedQuery: resolvedNormalizedQuery,
        quantityText: resolvedQuantityText,
        quantityMultiplier: item.quantityMultiplier,
        gramsEstimate: freshResolution.gramsEstimate ?? item.gramsEstimate ?? null,
        sourceAssetIds: item.sourceAssetIds,
        confidence: Math.min(item.confidence, freshResolution.confidence),
        unresolved: item.unresolved,
        reasoning: `${item.reasoning} ${freshResolution.reasoning}`,
        nutritionSource: 'FRESH_ANALYSIS',
        nutritionCacheEntryId: createdCacheEntry?.id ?? null,
        normalizedFoodEntryId: null,
        resolutionMetadata: {
          method: 'fresh_analysis',
          matchConfidence: Math.min(normalization.normalizationConfidence || freshResolution.confidence, freshResolution.confidence),
          matchedKeyword: normalization.matchedKeyword,
        },
        macros: freshResolution.macros,
      });
    }

    return {
      stage: 'stage_2_nutrition_resolution' as const,
      provider: this.provider,
      model: this.model,
      warnings,
      resolvedItems,
      diagnostics: stage2Diagnostics
        ? {
            nutritionResolver: {
              responseId: stage2Diagnostics.responseId,
              responseStatus: stage2Diagnostics.responseStatus,
              structuredOutputFound: stage2Diagnostics.structuredOutputFound,
              outputTextPreview: stage2Diagnostics.outputTextPreview,
              canonicalName: stage2Diagnostics.canonicalName,
              gramsEstimate: stage2Diagnostics.gramsEstimate,
              genericPhotoPlaceholder: stage2Diagnostics.genericPhotoPlaceholder,
              usedImageContext: stage2Diagnostics.usedImageContext,
            },
          }
        : undefined,
    };
  }
}
