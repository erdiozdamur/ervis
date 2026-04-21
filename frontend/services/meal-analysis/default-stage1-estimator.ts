import { randomUUID } from 'node:crypto';
import { getServerEnv } from '@/lib/env';
import { getDefaultMealTitleSuggestion } from '@/lib/meals/draft-title';
import { getAnalysisRules } from '@/services/meal-analysis/analysis-rule-repository';
import type { MealAnalysisContext, MealAnalysisStage1Estimator, Stage1ItemFactoryInput } from '@/services/meal-analysis/contracts';
import { normalizeFoodQuery, parseTextIntoFoodSegments, suggestMealTypeFromConsumedAt } from '@/services/meal-analysis/heuristics';
import { extractMealItemsFromImageWithOpenAi } from '@/services/meal-analysis/openai-stage1-image-itemizer';
import type { MealStage1EstimatedItem } from '@/types/meal-analysis';
import type { MealAnalysisAssetInput } from '@/types/meal-analysis';

function normalizeGenericFileNameToken(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().replace(/\s+/g, '');
}

function isGenericImageNameToken(compactValue: string, prefixes: string[]) {
  if (/^[a-z][a-f0-9]{16,}$/i.test(compactValue) || /^[a-z]-[a-f0-9]{16,}$/i.test(compactValue)) {
    return true;
  }

  if (/^[a-f0-9]{24,}$/i.test(compactValue)) {
    return true;
  }

  return prefixes.some((prefix) => {
    if (!compactValue.startsWith(prefix)) {
      return false;
    }

    const rest = compactValue.slice(prefix.length);
    if (prefix === normalizeFoodQuery('whatsapp image').replace(/\s+/g, '')) {
      return true;
    }

    return rest.length === 0 || /^\d+$/.test(rest);
  });
}

function createEstimatedItem(input: Stage1ItemFactoryInput): MealStage1EstimatedItem {
  return {
    id: randomUUID(),
    displayName: input.displayName,
    normalizedQuery: input.normalizedQuery,
    quantityText: input.quantityText,
    quantityMultiplier: input.quantityMultiplier,
    sourceAssetIds: input.sourceAssetIds,
    confidence: input.confidence,
    unresolved: input.unresolved,
    reasoning: input.reasoning,
  };
}

function looksLikeGenericFileName(labelHint: string, prefixes: string[]) {
  const normalized = normalizeFoodQuery(labelHint);
  const compactNormalized = normalizeGenericFileNameToken(labelHint);

  if (!normalized) {
    return true;
  }

  if (/\.(jpg|jpeg|png|webp|heic|gif|bmp|tiff?)$/i.test(labelHint.trim())) {
    const basename = labelHint
      .trim()
      .replace(/\.(jpg|jpeg|png|webp|heic|gif|bmp|tiff?)$/i, '')
      .trim();
    const compactBase = normalizeGenericFileNameToken(basename);

    if (isGenericImageNameToken(compactBase, prefixes)) {
      return true;
    }
  }

  return isGenericImageNameToken(compactNormalized, prefixes);
}

function getImageLabelSegment(labelHint: string | null, prefixes: string[]) {
  if (!labelHint || looksLikeGenericFileName(labelHint, prefixes)) {
    return null;
  }

  const segment = parseTextIntoFoodSegments(labelHint.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '))[0];
  if (!segment) {
    return null;
  }

  if (looksLikeGenericFileName(segment.displayName, prefixes)) {
    return null;
  }

  return segment;
}

function assetLabel(source: string | null, fallback: string) {
  if (!source) return fallback;
  if (source === 'camera') return 'Camera meal item';
  if (source === 'recording') return 'Voice note meal item';
  if (source === 'upload') return `Uploaded ${fallback.toLowerCase()} item`;
  return fallback;
}

function getImageFallbackPortionLabel(context: MealAnalysisContext, labelHint: string | null) {
  const normalizedHint = labelHint ? normalizeFoodQuery(labelHint) : '';

  if (/(ayran|kahve|cay|çay|latte|cappuccino|smoothie|juice|meyve suyu|milkshake)/.test(normalizedHint)) {
    return {
      quantityText: '1 bardak',
      quantityMultiplier: 1,
      displayName: 'Fotoğraftaki içecek',
    };
  }

  if (/(corba|çorba|soup|yogurt|yoğurt|oat|granola)/.test(normalizedHint)) {
    return {
      quantityText: '1 kase',
      quantityMultiplier: 1,
      displayName: 'Fotoğraftaki kase',
    };
  }

  if (context.mealType === 'SNACK') {
    return {
      quantityText: '1 porsiyon',
      quantityMultiplier: 1,
      displayName: 'Fotoğraftaki atıştırmalık',
    };
  }

  return {
    quantityText: '1 tabak',
    quantityMultiplier: 1,
    displayName: 'Fotoğraftaki tabak',
  };
}

function getImageFallbackDisplayName(labelHint: string | null, prefixes: string[]) {
  const labelSegment = getImageLabelSegment(labelHint, prefixes);
  if (labelSegment) {
    return labelSegment;
  }

  return {
    displayName: 'Fotoğraftaki öğün',
    normalizedQuery: normalizeFoodQuery('Fotoğraftaki öğün'),
  };
}

function toImageFallbackReason(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const normalizedMessage = message.toLocaleLowerCase('tr-TR');

  if (!message) {
    return 'Görsel ayrıştırma tamamlanamadı.';
  }

  if (normalizedMessage.includes('structured output')) {
    return 'Model yapılandırılmış sonuç döndüremedi.';
  }

  if (normalizedMessage.includes('storage key')) {
    return 'Görsel dosyası analiz için hazırlanamadı.';
  }

  if (normalizedMessage.includes('request failed') || normalizedMessage.includes('api')) {
    return 'Görsel modeli isteği başarısız oldu.';
  }

  return 'Görsel ayrıştırma tamamlanamadı.';
}

function parseStructuredTextItems(input: { textContent: string | null; assetId: string; confidence: number; reasoning: string }) {
  if (!input.textContent) {
    return [];
  }

  return parseTextIntoFoodSegments(input.textContent).map((segment) =>
    createEstimatedItem({
      displayName: segment.displayName,
      normalizedQuery: segment.normalizedQuery,
      quantityText: segment.quantityText,
      quantityMultiplier: segment.quantityMultiplier,
      sourceAssetIds: [input.assetId],
      confidence: input.confidence,
      unresolved: false,
      reasoning: input.reasoning,
    }),
  );
}

export class DefaultMealStage1Estimator implements MealAnalysisStage1Estimator {
  provider = 'heuristic-stage1';
  model = getServerEnv().MEAL_ANALYSIS_STAGE1_MODEL;
  protected async extractImageItems(input: Parameters<typeof extractMealItemsFromImageWithOpenAi>[0]) {
    return extractMealItemsFromImageWithOpenAi(input);
  }

  protected async analyzeImageAsset(context: MealAnalysisContext, asset: MealAnalysisAssetInput, genericImageNamePrefixes: string[]) {
    const env = getServerEnv();
    const warnings: string[] = [];
    let fallbackReason = 'Görsel ayrıştırma sonucu alınamadı.';
    let itemizerDiagnostics:
      | {
          responseId: string | null;
          responseStatus: string | null;
          structuredOutputFound: boolean;
          outputTextPreview: string | null;
          rawItemCount: number;
          finalItemCount: number;
          retryTriggered: boolean;
          retryUsed: boolean;
          fallbackReason: string | null;
        }
      | null = null;

    if (!(env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY && asset.storageKey)) {
      fallbackReason = 'Canlı görsel modeli kullanılamadı.';
      return {
        warnings,
        diagnostics: itemizerDiagnostics,
        estimatedItems: this.createFallbackImageItems(context, asset, fallbackReason, genericImageNamePrefixes),
      };
    }

    try {
      const imageResult = await this.extractImageItems({
        asset,
        mealContext: {
          mealType: context.mealType,
          consumedAtIso: context.consumedAt.toISOString(),
        },
      });

      if (imageResult.warning) {
        warnings.push(imageResult.warning);
      }

      itemizerDiagnostics = {
        ...imageResult.diagnostics,
        finalItemCount: imageResult.items.length,
        fallbackReason: null,
      };

      if (imageResult.items.length > 0) {
        return {
          warnings,
          diagnostics: itemizerDiagnostics,
          estimatedItems: imageResult.items.map((itemFromImage) =>
            createEstimatedItem({
              displayName: itemFromImage.displayName,
              normalizedQuery: normalizeFoodQuery(itemFromImage.displayName),
              quantityText: itemFromImage.quantityText,
              quantityMultiplier: itemFromImage.quantityMultiplier,
              sourceAssetIds: [asset.id],
              confidence: itemFromImage.confidence,
              unresolved: true,
              reasoning: itemFromImage.reasoning,
            }),
          ),
        };
      }

      fallbackReason = 'Ayrıştırılabilir besin bulunamadı.';
    } catch (error) {
      fallbackReason = toImageFallbackReason(error);
    }

    return {
      warnings,
      diagnostics:
        itemizerDiagnostics ?? {
          responseId: null,
          responseStatus: null,
          structuredOutputFound: false,
          outputTextPreview: null,
          rawItemCount: 0,
          finalItemCount: 0,
          retryTriggered: false,
          retryUsed: false,
          fallbackReason,
        },
      estimatedItems: this.createFallbackImageItems(context, asset, fallbackReason, genericImageNamePrefixes),
    };
  }

  protected createFallbackImageItems(context: MealAnalysisContext, asset: MealAnalysisAssetInput, fallbackReason: string, genericImageNamePrefixes: string[]) {
    const portionEstimate = getImageFallbackPortionLabel(context, asset.labelHint);
    const fallbackDisplay = getImageFallbackDisplayName(asset.labelHint, genericImageNamePrefixes);

    return [
      createEstimatedItem({
        displayName: fallbackDisplay.displayName,
        normalizedQuery: fallbackDisplay.normalizedQuery,
        quantityText: portionEstimate.quantityText,
        quantityMultiplier: portionEstimate.quantityMultiplier,
        sourceAssetIds: [asset.id],
        confidence: 0.34,
        unresolved: true,
        reasoning: `${fallbackReason} Bu yüzden görsel tek öğelik inceleme taslağına indirildi.`,
      }),
    ];
  }

  async estimate(context: MealAnalysisContext) {
    const ruleSnapshot = await getAnalysisRules();
    const genericImageNamePrefixes = ruleSnapshot.rules.stage1.genericImageNamePrefixes
      .map((value) => normalizeGenericFileNameToken(value));
    const warnings: string[] = [];
    const estimatedItems: MealStage1EstimatedItem[] = [];
    let stage1Diagnostics: {
      itemizer: {
        responseId: string | null;
        responseStatus: string | null;
        structuredOutputFound: boolean;
        outputTextPreview: string | null;
        rawItemCount: number;
        finalItemCount: number;
        retryTriggered: boolean;
        retryUsed: boolean;
        fallbackReason: string | null;
      };
    } | null = null;

    for (const asset of context.assets) {
      if (asset.assetType === 'TEXT' && asset.textContent) {
        estimatedItems.push(
          ...parseStructuredTextItems({
            textContent: asset.textContent,
            assetId: asset.id,
            confidence: 0.9,
            reasoning: 'Derived directly from typed meal text, including quantity language when present.',
          }),
        );
      }

      if (asset.assetType === 'AUDIO' && asset.textContent) {
        estimatedItems.push(
          ...parseStructuredTextItems({
            textContent: asset.textContent,
            assetId: asset.id,
            confidence: 0.8,
            reasoning: 'Derived from an audio transcript and converted into reviewable food items.',
          }),
        );
      }

      if (asset.assetType === 'IMAGE') {
        warnings.push('Fotoğraf analizi tahminleri kaydetmeden önce kontrol edilmelidir.');
        const imageAnalysis = await this.analyzeImageAsset(context, asset, genericImageNamePrefixes);
        warnings.push(...imageAnalysis.warnings);
        estimatedItems.push(...imageAnalysis.estimatedItems);
        if (imageAnalysis.diagnostics) {
          stage1Diagnostics = {
            itemizer: imageAnalysis.diagnostics,
          };
          warnings.push(
            `Stage 1 itemizer diagnostics: id=${imageAnalysis.diagnostics.responseId ?? 'n/a'}, status=${imageAnalysis.diagnostics.responseStatus ?? 'n/a'}, structured=${imageAnalysis.diagnostics.structuredOutputFound ? 'yes' : 'no'}, raw_items=${imageAnalysis.diagnostics.rawItemCount}, final_items=${imageAnalysis.diagnostics.finalItemCount}, retry=${imageAnalysis.diagnostics.retryTriggered ? (imageAnalysis.diagnostics.retryUsed ? 'used' : 'triggered_no_effect') : 'no'}, fallback=${imageAnalysis.diagnostics.fallbackReason ?? 'none'}`,
          );
        }

        if (imageAnalysis.estimatedItems.some((item) => item.confidence <= 0.34)) {
          warnings.push('Görsel analizi tek öğelik inceleme taslağına indirildi.');
        }
      }

      if (asset.assetType === 'AUDIO') {
        if (!asset.textContent) {
          warnings.push('Audio-based items stay unresolved until a transcript is available or the user edits them.');
          estimatedItems.push(
            createEstimatedItem({
              displayName: assetLabel(asset.source, 'Audio meal item'),
              normalizedQuery: normalizeFoodQuery(assetLabel(asset.source, 'Audio meal item')),
              quantityText: '1 porsiyon',
              quantityMultiplier: 1,
              sourceAssetIds: [asset.id],
              confidence: 0.36,
              unresolved: true,
              reasoning: 'A voice note was attached without transcript text, so stage 1 created a conservative draft placeholder.',
            }),
          );
        }
      }
    }

    if (estimatedItems.length === 0) {
      warnings.push('No structured food estimate could be produced from the submitted inputs.');
      estimatedItems.push(
        createEstimatedItem({
          displayName: 'Unresolved meal item',
          normalizedQuery: 'unresolved meal item',
          quantityText: null,
          quantityMultiplier: 1,
          sourceAssetIds: context.assets.map((asset) => asset.id),
          confidence: 0.2,
          unresolved: true,
          reasoning: 'The intake did not contain enough structured detail to infer a clearer meal item.',
        }),
      );
    }

    const mealTypeSuggestion = suggestMealTypeFromConsumedAt(context.consumedAt);
    const mealTitleSuggestion = getDefaultMealTitleSuggestion(mealTypeSuggestion);

    return {
      stage: 'stage_1_estimation' as const,
      provider: this.provider,
      model: this.model,
      mealTypeSuggestion,
      mealTitleSuggestion,
      warnings,
      estimatedItems,
      diagnostics: stage1Diagnostics ?? undefined,
    };
  }
}
