import { createHash } from 'node:crypto';
import type { FoodCatalogEntry, SharedNutritionSource } from '@prisma/client';
import type { ResolvedNutritionMacros } from '@/types/meal-analysis';
import { createFoodCatalogSlug, findHeuristicFoodTemplateMatch, normalizeFoodQuery } from '@/services/meal-analysis/heuristics';

type DecimalLike = {
  toNumber(): number;
};

type MacrosCarrier = {
  calories: number | DecimalLike | null | undefined;
  proteinGrams: number | DecimalLike | null | undefined;
  carbGrams: number | DecimalLike | null | undefined;
  fatGrams: number | DecimalLike | null | undefined;
  fiberGrams: number | DecimalLike | null | undefined;
};

export function buildNutritionCacheKey(normalizedQuery: string, quantityMultiplier: number) {
  return `meal-analysis:${createHash('sha1').update(`${normalizedQuery}:${quantityMultiplier}`).digest('hex')}`;
}

export type FoodNormalizationSnapshot = {
  originalQuery: string;
  normalizedQuery: string;
  canonicalQuery: string;
  canonicalSlug: string;
  cacheIdentity: string;
  searchSlugs: string[];
  searchNames: string[];
  normalizationConfidence: number;
  strategy: 'raw_query' | 'safe_variant_family';
  matchedKeyword: string | null;
  removedDescriptors: string[];
};

export function roundNumericValue(value: number) {
  return Math.round(value * 10) / 10;
}

export function scaleResolvedMacros(macros: ResolvedNutritionMacros, quantityMultiplier: number): ResolvedNutritionMacros {
  return {
    calories: roundNumericValue(macros.calories * quantityMultiplier),
    proteinGrams: roundNumericValue(macros.proteinGrams * quantityMultiplier),
    carbGrams: roundNumericValue(macros.carbGrams * quantityMultiplier),
    fatGrams: roundNumericValue(macros.fatGrams * quantityMultiplier),
    fiberGrams: roundNumericValue(macros.fiberGrams * quantityMultiplier),
  };
}

export function toResolvedMacros(values: MacrosCarrier): ResolvedNutritionMacros {
  return {
    calories: Number(values.calories ?? 0),
    proteinGrams: Number(values.proteinGrams ?? 0),
    carbGrams: Number(values.carbGrams ?? 0),
    fatGrams: Number(values.fatGrams ?? 0),
    fiberGrams: Number(values.fiberGrams ?? 0),
  };
}

export function hasCompleteMacros(values: MacrosCarrier) {
  return (
    values.calories != null &&
    values.proteinGrams != null &&
    values.carbGrams != null &&
    values.fatGrams != null &&
    values.fiberGrams != null
  );
}

export function scoreFoodCatalogEntryMatch(
  normalizedQuery: string,
  entry: Pick<FoodCatalogEntry, 'slug' | 'canonicalName' | 'brandName'>,
) {
  const normalizedCanonicalName = normalizeFoodQuery(entry.canonicalName);
  const normalizedBrandName = entry.brandName ? normalizeFoodQuery(entry.brandName) : '';
  const querySlug = createFoodCatalogSlug(normalizedQuery);

  if (entry.slug === querySlug) {
    return 1;
  }

  if (normalizedCanonicalName === normalizedQuery) {
    return 0.98;
  }

  if (normalizedBrandName && normalizedQuery === `${normalizedBrandName} ${normalizedCanonicalName}`.trim()) {
    return 0.96;
  }

  if (normalizedQuery.includes(normalizedCanonicalName) || normalizedCanonicalName.includes(normalizedQuery)) {
    return 0.91;
  }

  return 0;
}

export function getSharedCatalogCandidate(normalizedQuery: string) {
  const matched = findHeuristicFoodTemplateMatch(normalizedQuery);

  if (!matched) {
    return null;
  }

  return {
    slug: matched.template.slug,
    canonicalName: matched.template.canonicalName,
    localizedName: matched.template.localizedName,
    source: 'AI_ESTIMATE' as SharedNutritionSource,
    defaultServingAmount: matched.template.defaultServingAmount ?? 1,
    defaultServingUnit: matched.template.defaultServingUnit ?? 'portion',
    macros: matched.template.macros,
    confidence: matched.template.confidence,
    matchedKeyword: matched.keyword,
    safeVariantKeywords: matched.template.safeVariantKeywords ?? [],
    reasoning: matched.template.reasoning,
  };
}

export type SharedCatalogCandidate = NonNullable<ReturnType<typeof getSharedCatalogCandidate>>;

export function shouldPromoteSharedCatalogCandidate(
  normalizedQuery: string,
  candidate: NonNullable<SharedCatalogCandidate>,
) {
  const normalizedCanonicalName = normalizeFoodQuery(candidate.canonicalName);

  if (normalizedQuery === candidate.matchedKeyword || normalizedQuery === normalizedCanonicalName) {
    return true;
  }

  if (normalizedQuery === candidate.slug.replace(/-/g, ' ')) {
    return true;
  }

  return candidate.matchedKeyword.length / Math.max(normalizedQuery.length, 1) >= 0.85;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function resolveFoodNormalization(originalQuery: string): FoodNormalizationSnapshot {
  const normalizedQuery = normalizeFoodQuery(originalQuery);
  const sharedCandidate = getSharedCatalogCandidate(normalizedQuery);

  if (!sharedCandidate || !shouldPromoteSharedCatalogCandidate(normalizedQuery, sharedCandidate)) {
    return {
      originalQuery,
      normalizedQuery,
      canonicalQuery: normalizedQuery,
      canonicalSlug: createFoodCatalogSlug(normalizedQuery),
      cacheIdentity: normalizedQuery,
      searchSlugs: uniqueStrings([createFoodCatalogSlug(normalizedQuery)]),
      searchNames: uniqueStrings([normalizedQuery]),
      normalizationConfidence: 0,
      strategy: 'raw_query',
      matchedKeyword: null,
      removedDescriptors: [],
    };
  }

  const descriptorTokens = sharedCandidate.safeVariantKeywords
    .filter((keyword) => keyword !== sharedCandidate.matchedKeyword)
    .flatMap((keyword) => normalizeFoodQuery(keyword).split(' '))
    .filter((token) => token !== normalizeFoodQuery(sharedCandidate.canonicalName));

  return {
    originalQuery,
    normalizedQuery,
    canonicalQuery: normalizeFoodQuery(sharedCandidate.canonicalName),
    canonicalSlug: sharedCandidate.slug,
    cacheIdentity: sharedCandidate.slug,
    searchSlugs: uniqueStrings([sharedCandidate.slug, createFoodCatalogSlug(normalizedQuery)]),
    searchNames: uniqueStrings([normalizeFoodQuery(sharedCandidate.canonicalName), normalizedQuery]),
    normalizationConfidence: sharedCandidate.confidence,
    strategy: 'safe_variant_family',
    matchedKeyword: sharedCandidate.matchedKeyword,
    removedDescriptors: uniqueStrings(descriptorTokens.filter((token) => normalizedQuery.includes(token))),
  };
}

export type CacheMetadata = {
  resolutionMethod: 'shared_cache' | 'shared_catalog' | 'fresh_analysis';
  resolvedBy: string;
  resolvedAt: string;
  matchConfidence: number;
  matchedKeyword: string | null;
  normalizedFoodEntryId: string | null;
  catalogSlug: string | null;
  cacheIdentity: string;
  normalizationStrategy: FoodNormalizationSnapshot['strategy'];
  removedDescriptors: string[];
  contextMealId: string;
  reasoning: string;
};

export type PersistableCacheShape = {
  cacheKey: string;
  normalizedQueryText: string;
  source: SharedNutritionSource;
  provider: string | null;
  normalizedFoodEntryId: string | null;
  servingAmount: number | null;
  servingUnit: string | null;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  fiberGrams: number;
  payloadJson: CacheMetadata;
};
