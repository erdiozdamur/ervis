import type { MealType } from '@prisma/client';
import type { HeuristicFoodTemplate, ParsedTextFoodSegment, ResolvedNutritionMacros } from '@/services/meal-analysis/contracts';

const punctuationPattern = /[^\p{L}\p{N}\s]/gu;
const quantityUnitPattern =
  /^(tabak|kase|bardak|porsiyon|porsiyonluk|adet|dilim|fincan|kupa|avuc|avuç|parca|parça|sise|şişe|kutu|kasik|kaşık|g|gr|gram|kg|ml|l|lt|litre|menu|menü)$/i;
const numericAmountPattern = /^\d+(?:[.,]\d+)?$/;
const compactAmountWithUnitPattern = /^(\d+(?:[.,]\d+)?)(g|gr|gram|kg|ml|l|lt)$/i;
const turkishNumberMap = new Map<string, number>([
  ['tek', 1],
  ['bir', 1],
  ['iki', 2],
  ['uc', 3],
  ['üç', 3],
  ['dort', 4],
  ['dört', 4],
  ['bes', 5],
  ['beş', 5],
  ['alti', 6],
  ['altı', 6],
  ['yedi', 7],
  ['sekiz', 8],
  ['dokuz', 9],
  ['on', 10],
  ['yarim', 0.5],
  ['yarım', 0.5],
  ['ceyrek', 0.25],
  ['çeyrek', 0.25],
  ['bucuk', 0.5],
  ['buçuk', 0.5],
]);

const heuristicFoodTemplates: HeuristicFoodTemplate[] = [
  {
    canonicalName: 'Egg',
    localizedName: 'Yumurta',
    slug: 'egg',
    keywords: ['egg', 'eggs', 'omelette', 'yumurta', 'omlet'],
    macros: { calories: 78, proteinGrams: 6, carbGrams: 1, fatGrams: 5, fiberGrams: 0 },
    confidence: 0.88,
    reasoning: 'Matched an egg-based keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'piece',
  },
  {
    canonicalName: 'Chicken breast',
    localizedName: 'Tavuk göğsü',
    slug: 'chicken-breast',
    keywords: ['chicken', 'grilled chicken', 'chicken breast', 'tavuk', 'izgara tavuk', 'tavuk gogus', 'tavuk göğüs'],
    safeVariantKeywords: ['grilled chicken', 'izgara tavuk', 'tavuk gogus', 'tavuk göğüs'],
    macros: { calories: 165, proteinGrams: 31, carbGrams: 0, fatGrams: 4, fiberGrams: 0 },
    confidence: 0.86,
    reasoning: 'Matched a lean chicken keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'portion',
  },
  {
    canonicalName: 'Rice pilaf',
    localizedName: 'Pilav',
    slug: 'rice-pilaf',
    keywords: ['rice', 'pilaf', 'bulgur', 'pilav', 'pirinc pilavi', 'pirinç pilavı', 'bulgur pilavi', 'bulgur pilavı'],
    macros: { calories: 205, proteinGrams: 4, carbGrams: 45, fatGrams: 0, fiberGrams: 1 },
    confidence: 0.8,
    reasoning: 'Matched a grain/starch keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'plate',
  },
  {
    canonicalName: 'Bread',
    localizedName: 'Ekmek',
    slug: 'bread',
    keywords: ['bread', 'toast', 'bagel', 'sourdough', 'ekmek', 'tost'],
    macros: { calories: 95, proteinGrams: 4, carbGrams: 18, fatGrams: 1, fiberGrams: 2 },
    confidence: 0.8,
    reasoning: 'Matched a bread keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'slice',
  },
  {
    canonicalName: 'Salad',
    localizedName: 'Salata',
    slug: 'salad',
    keywords: ['salad', 'greens', 'salata', 'yesillik', 'yeşillik'],
    macros: { calories: 80, proteinGrams: 3, carbGrams: 10, fatGrams: 3, fiberGrams: 3 },
    confidence: 0.72,
    reasoning: 'Matched a salad keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'bowl',
  },
  {
    canonicalName: 'Yogurt drink',
    localizedName: 'Ayran',
    slug: 'yogurt-drink',
    keywords: ['yogurt', 'ayran', 'yoğurt', 'yoghurt'],
    macros: { calories: 110, proteinGrams: 8, carbGrams: 9, fatGrams: 4, fiberGrams: 0 },
    confidence: 0.76,
    reasoning: 'Matched a yogurt-based keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'glass',
  },
  {
    canonicalName: 'Milk coffee',
    localizedName: 'Sütlü kahve',
    slug: 'milk-coffee',
    keywords: ['coffee', 'latte', 'cappuccino', 'kahve', 'sutlu kahve', 'sütlü kahve'],
    macros: { calories: 60, proteinGrams: 3, carbGrams: 5, fatGrams: 3, fiberGrams: 0 },
    confidence: 0.68,
    reasoning: 'Matched a beverage keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'cup',
  },
  {
    canonicalName: 'Fresh fruit',
    localizedName: 'Meyve',
    slug: 'fresh-fruit',
    keywords: ['apple', 'banana', 'orange', 'fruit', 'elma', 'muz', 'portakal', 'meyve'],
    macros: { calories: 95, proteinGrams: 1, carbGrams: 25, fatGrams: 0, fiberGrams: 3 },
    confidence: 0.74,
    reasoning: 'Matched a fruit keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'piece',
  },
  {
    canonicalName: 'Big Mac menu',
    localizedName: 'Big Mac menü',
    slug: 'big-mac-menu',
    keywords: [
      'big mac menu',
      'bigmac menu',
      'big mac menü',
      'bigmac menü',
      'mig mac menu',
      'mig mac menü',
      'mcdonalds big mac menu',
    ],
    safeVariantKeywords: ['big mac menu', 'big mac menü', 'bigmac menu', 'mig mac menu'],
    macros: { calories: 1070, proteinGrams: 30, carbGrams: 129, fatGrams: 48, fiberGrams: 6 },
    confidence: 0.9,
    reasoning: 'Matched a branded fast-food combo keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'menu',
  },
  {
    canonicalName: 'Wrap or sandwich',
    localizedName: 'Dürüm veya sandviç',
    slug: 'wrap-sandwich',
    keywords: ['wrap', 'sandwich', 'burger', 'durum', 'döner wrap', 'sandvic', 'sandviç', 'burger'],
    macros: { calories: 360, proteinGrams: 18, carbGrams: 34, fatGrams: 16, fiberGrams: 3 },
    confidence: 0.7,
    reasoning: 'Matched a prepared meal keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'portion',
  },
  {
    canonicalName: 'Lentil soup',
    localizedName: 'Mercimek çorbası',
    slug: 'lentil-soup',
    keywords: ['mercimek corbasi', 'mercimek çorbası', 'corba', 'çorba', 'soup'],
    safeVariantKeywords: ['mercimek corbasi', 'mercimek çorbası', 'lentil soup'],
    macros: { calories: 160, proteinGrams: 8, carbGrams: 22, fatGrams: 4, fiberGrams: 5 },
    confidence: 0.84,
    reasoning: 'Matched a soup keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'bowl',
  },
  {
    canonicalName: 'Beef steak',
    localizedName: 'Biftek',
    slug: 'beef-steak',
    keywords: ['biftek', 'dana biftek', 'izgara biftek', 'ızgara biftek', 'steak', 'beef steak', 'grilled steak'],
    safeVariantKeywords: ['dana biftek', 'izgara biftek', 'ızgara biftek', 'grilled steak', 'beef steak'],
    macros: { calories: 271, proteinGrams: 26, carbGrams: 0, fatGrams: 18, fiberGrams: 0 },
    confidence: 0.91,
    reasoning: 'Matched a steak keyword from the shared heuristic table.',
    defaultServingAmount: 1,
    defaultServingUnit: 'portion',
  },
];

function sentenceCase(value: string) {
  const compact = value.replace(/\s+/g, ' ').trim();

  if (!compact) {
    return compact;
  }

  return `${compact.charAt(0).toLocaleUpperCase('tr-TR')}${compact.slice(1)}`;
}

export function normalizeFoodQuery(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .toLocaleLowerCase('tr-TR')
    .replace(punctuationPattern, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createFoodCatalogSlug(value: string) {
  return normalizeFoodQuery(value).replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

export function findHeuristicFoodTemplateMatch(normalizedQuery: string) {
  const matched = heuristicFoodTemplates
    .flatMap((template) =>
      template.keywords.map((keyword) => ({
        template,
        keyword: normalizeFoodQuery(keyword),
      })),
    )
    .filter((candidate) => normalizedQuery.includes(candidate.keyword))
    .sort((left, right) => right.keyword.length - left.keyword.length)[0];

  return matched ?? null;
}

export function localizeFoodDisplayName(value: string) {
  const normalizedValue = normalizeFoodQuery(value);
  const matched = normalizedValue ? findHeuristicFoodTemplateMatch(normalizedValue) : null;

  if (matched) {
    return matched.template.localizedName;
  }

  return sentenceCase(value);
}

function normalizeQuantityMultiplier(amount: number, unit: string | null) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 1;
  }

  const normalizedUnit = unit?.trim().toLocaleLowerCase('tr-TR') ?? null;
  if (!normalizedUnit) {
    return amount;
  }

  if (['g', 'gr', 'gram', 'ml'].includes(normalizedUnit)) {
    return amount / 100;
  }

  if (['kg', 'l', 'lt', 'litre'].includes(normalizedUnit)) {
    return amount * 10;
  }

  return amount;
}

function parseLeadingAmountToken(tokens: string[]) {
  const first = tokens[0];
  const second = tokens[1];
  const third = tokens[2];

  if (!first) {
    return null;
  }

  const normalizedFirst = normalizeFoodQuery(first);
  const normalizedSecond = second ? normalizeFoodQuery(second) : null;
  const normalizedThird = third ? normalizeFoodQuery(third) : null;

  if (
    normalizedFirst &&
    numericAmountPattern.test(normalizedFirst) &&
    normalizedSecond &&
    ['bucuk', 'buçuk'].includes(normalizedSecond)
  ) {
    return {
      amount: Number(normalizedFirst.replace(',', '.')) + 0.5,
      tokenCount: 2,
    };
  }

  if (
    normalizedFirst &&
    ['bir', 'iki', 'uc', 'üç', 'dort', 'dört', 'bes', 'beş', 'alti', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'].includes(
      normalizedFirst,
    ) &&
    normalizedSecond &&
    ['bucuk', 'buçuk'].includes(normalizedSecond)
  ) {
    return {
      amount: (turkishNumberMap.get(normalizedFirst) ?? 1) + 0.5,
      tokenCount: 2,
    };
  }

  if (normalizedFirst && turkishNumberMap.has(normalizedFirst)) {
    if (normalizedFirst === 'bir' && normalizedSecond && ['bucuk', 'buçuk'].includes(normalizedSecond)) {
      return {
        amount: 1.5,
        tokenCount: 2,
      };
    }

    return {
      amount: turkishNumberMap.get(normalizedFirst) ?? 1,
      tokenCount: 1,
    };
  }

  if (normalizedFirst && numericAmountPattern.test(normalizedFirst)) {
    return {
      amount: Number(normalizedFirst.replace(',', '.')),
      tokenCount: 1,
    };
  }

  if (
    normalizedFirst === 'bir' &&
    normalizedSecond &&
    ['bucuk', 'buçuk'].includes(normalizedSecond) &&
    normalizedThird &&
    quantityUnitPattern.test(normalizedThird)
  ) {
    return {
      amount: 1.5,
      tokenCount: 2,
    };
  }

  return null;
}

function extractQuantityFromSegment(segment: string) {
  const compact = segment.replace(/\s+/g, ' ').trim();

  if (!compact) {
    return {
      quantityText: null,
      quantityMultiplier: 1,
      remainder: compact,
    };
  }

  const tokens = compact.split(' ');
  const compactMatch = compactAmountWithUnitPattern.exec(normalizeFoodQuery(tokens[0] ?? ''));
  if (compactMatch) {
    const remainder = tokens.slice(1).join(' ').trim();
    if (!remainder) {
      return {
        quantityText: null,
        quantityMultiplier: 1,
        remainder: compact,
      };
    }

    const amount = Number(compactMatch[1].replace(',', '.'));
    const unit = compactMatch[2].toLocaleLowerCase('tr-TR');
    return {
      quantityText: `${compactMatch[1]} ${unit}`,
      quantityMultiplier: normalizeQuantityMultiplier(amount, unit),
      remainder,
    };
  }

  const parsedAmount = parseLeadingAmountToken(tokens);

  if (!parsedAmount) {
    return {
      quantityText: null,
      quantityMultiplier: 1,
      remainder: compact,
    };
  }

  const unitToken = tokens[parsedAmount.tokenCount];
  const hasUnit = Boolean(unitToken && quantityUnitPattern.test(normalizeFoodQuery(unitToken)));
  const consumedTokenCount = hasUnit ? parsedAmount.tokenCount + 1 : parsedAmount.tokenCount;
  const remainder = tokens.slice(consumedTokenCount).join(' ').trim();
  const quantityText = tokens.slice(0, consumedTokenCount).join(' ').trim();

  if (!remainder) {
    return {
      quantityText: null,
      quantityMultiplier: 1,
      remainder: compact,
    };
  }

  const normalizedUnit = hasUnit && unitToken ? normalizeFoodQuery(unitToken) : null;
  return {
    quantityText,
    quantityMultiplier:
      Number.isFinite(parsedAmount.amount) && parsedAmount.amount > 0
        ? normalizeQuantityMultiplier(parsedAmount.amount, normalizedUnit)
        : 1,
    remainder,
  };
}

export function parseTextIntoFoodSegments(value: string): ParsedTextFoodSegment[] {
  const compact = value.trim();

  if (!compact) {
    return [];
  }

  const rawSegments = compact
    .replace(/[+&]/g, ',')
    .split(/\n|,|;/)
    .flatMap((segment) => segment.split(/\b(?:and|ve|ile|yaninda|yanında|arti|artı)\b/gi))
    .map((segment) => segment.trim())
    .filter(Boolean);

  return rawSegments.slice(0, 8).map((segment) => {
    const parsedQuantity = extractQuantityFromSegment(segment);
    const displayName = sentenceCase(parsedQuantity.remainder);

    return {
      displayName,
      normalizedQuery: normalizeFoodQuery(displayName),
      quantityText: parsedQuantity.quantityText,
      quantityMultiplier: parsedQuantity.quantityMultiplier,
    };
  });
}

export function suggestMealTypeFromConsumedAt(date: Date): MealType {
  const hour = date.getUTCHours();

  if (hour >= 2 && hour < 9) return 'BREAKFAST';
  if (hour >= 9 && hour < 14) return 'LUNCH';
  if (hour >= 14 && hour < 20) return 'DINNER';
  return 'SNACK';
}

export function createFallbackMacros(): ResolvedNutritionMacros {
  return {
    calories: 240,
    proteinGrams: 12,
    carbGrams: 22,
    fatGrams: 10,
    fiberGrams: 2,
  };
}

export function estimateHeuristicMacros(normalizedQuery: string, quantityMultiplier = 1) {
  const matchedTemplate = findHeuristicFoodTemplateMatch(normalizedQuery)?.template;

  const template = matchedTemplate ?? {
    macros: createFallbackMacros(),
    confidence: 0.45,
    reasoning: 'No direct keyword match was found, so the resolver used a conservative fallback estimate.',
  };

  return {
    macros: {
      calories: Math.round(template.macros.calories * quantityMultiplier),
      proteinGrams: Math.round(template.macros.proteinGrams * quantityMultiplier),
      carbGrams: Math.round(template.macros.carbGrams * quantityMultiplier),
      fatGrams: Math.round(template.macros.fatGrams * quantityMultiplier),
      fiberGrams: Math.round(template.macros.fiberGrams * quantityMultiplier),
    },
    confidence: template.confidence,
    reasoning: template.reasoning,
  };
}
