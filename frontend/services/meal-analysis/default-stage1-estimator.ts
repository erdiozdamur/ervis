import { randomUUID } from 'node:crypto';
import { getServerEnv } from '@/lib/env';
import type { MealAnalysisContext, MealAnalysisStage1Estimator, Stage1ItemFactoryInput } from '@/services/meal-analysis/contracts';
import { normalizeFoodQuery, parseTextIntoFoodSegments, suggestMealTypeFromConsumedAt } from '@/services/meal-analysis/heuristics';
import { extractMealItemsFromImageWithOpenAi } from '@/services/meal-analysis/openai-stage1-image-itemizer';
import type { MealStage1EstimatedItem } from '@/types/meal-analysis';

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

function looksLikeGenericFileName(labelHint: string) {
  const normalized = normalizeFoodQuery(labelHint);

  if (!normalized) {
    return true;
  }

  if (/\.(jpg|jpeg|png|webp|heic|gif|bmp|tiff?)$/i.test(labelHint.trim())) {
    const basename = labelHint
      .trim()
      .replace(/\.(jpg|jpeg|png|webp|heic|gif|bmp|tiff?)$/i, '')
      .trim();
    const normalizedBase = normalizeFoodQuery(basename);

    if (/^(img|image|images|photo|camera|screenshot|ekran resmi|whatsapp image|dsc|pxl)(?:\s*\d+)?$/i.test(normalizedBase)) {
      return true;
    }
  }

  return /^(img|image|images|photo|camera|screenshot|ekran resmi|whatsapp image|dsc|pxl)(?:\s*\d+)?$/i.test(normalized);
}

function getImageLabelSegment(labelHint: string | null) {
  if (!labelHint || looksLikeGenericFileName(labelHint)) {
    return null;
  }

  const segment = parseTextIntoFoodSegments(labelHint.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '))[0];
  if (!segment) {
    return null;
  }

  if (looksLikeGenericFileName(segment.displayName)) {
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

function getGenericImageFallbackItems(context: MealAnalysisContext) {
  if (context.mealType === 'BREAKFAST') {
    return [
      { displayName: 'Yumurta', quantityText: '1 adet', quantityMultiplier: 1 },
      { displayName: 'Ekmek', quantityText: '1 dilim', quantityMultiplier: 1 },
      { displayName: 'Yoğurt', quantityText: '1 kase', quantityMultiplier: 1 },
    ];
  }

  if (context.mealType === 'SNACK') {
    return [
      { displayName: 'Meyve', quantityText: '1 adet', quantityMultiplier: 1 },
      { displayName: 'Yoğurt', quantityText: '1 kase', quantityMultiplier: 1 },
    ];
  }

  return [
    { displayName: 'Biftek', quantityText: '1 porsiyon', quantityMultiplier: 1 },
    { displayName: 'Pilav', quantityText: '1 porsiyon', quantityMultiplier: 1 },
    { displayName: 'Yoğurt', quantityText: '1 kase', quantityMultiplier: 1 },
  ];
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

  async estimate(context: MealAnalysisContext) {
    const warnings: string[] = [];
    const estimatedItems: MealStage1EstimatedItem[] = [];
    const env = getServerEnv();

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
        let extractedFromImage = false;

        try {
          if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY && asset.storageKey) {
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

            if (imageResult.items.length > 0) {
              extractedFromImage = true;
              estimatedItems.push(
                ...imageResult.items.map((itemFromImage) =>
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
              );
            }
          }
        } catch {
          warnings.push('Fotoğraf öğeleri otomatik ayrıştırılamadı; tek öğelik tahmin oluşturuldu.');
        }

        if (!extractedFromImage) {
          const portionEstimate = getImageFallbackPortionLabel(context, asset.labelHint);
          const labelSegment = getImageLabelSegment(asset.labelHint);

          if (labelSegment) {
            estimatedItems.push(
              createEstimatedItem({
                displayName: labelSegment.displayName,
                normalizedQuery: labelSegment.normalizedQuery,
                quantityText: portionEstimate.quantityText,
                quantityMultiplier: portionEstimate.quantityMultiplier,
                sourceAssetIds: [asset.id],
                confidence: 0.56,
                unresolved: true,
                reasoning: 'Fotoğraf etiketi çözümlemesinden ve konservatif porsiyon tahmininden oluşturuldu.',
              }),
            );
          } else {
            warnings.push('Canlı görsel modeli kullanılamadı; çoklu tahmini öğe çıkarımı uygulandı.');
            estimatedItems.push(
              ...getGenericImageFallbackItems(context).map((fallbackItem) =>
                createEstimatedItem({
                  displayName: fallbackItem.displayName,
                  normalizedQuery: normalizeFoodQuery(fallbackItem.displayName),
                  quantityText: fallbackItem.quantityText,
                  quantityMultiplier: fallbackItem.quantityMultiplier,
                  sourceAssetIds: [asset.id],
                  confidence: 0.34,
                  unresolved: true,
                  reasoning: 'Görselden çoklu tahmini öğe ayrıştırması uygulandı.',
                }),
              ),
            );
          }
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
    const mealTitleSuggestion = `${mealTypeSuggestion.charAt(0)}${mealTypeSuggestion.slice(1).toLowerCase()} draft`;

    return {
      stage: 'stage_1_estimation' as const,
      provider: this.provider,
      model: this.model,
      mealTypeSuggestion,
      mealTitleSuggestion,
      warnings,
      estimatedItems,
    };
  }
}
